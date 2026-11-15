import React, { useEffect, useRef } from 'react';
import { GameAssets } from '../game/assets';
import { soundEngine } from '../game/audio';
import { PIXELS_PER_METER } from '../game/levels';
import {
  createWorldSim,
  stepWorldSim,
  WorldSim,
} from '../game/physics';
import {
  CameraState,
  createInitialCamera,
  renderGameFrame,
  updateCamera,
} from '../game/renderer';
import {
  GameScreen,
  HudSnapshot,
  InputState,
  LevelConfig,
} from '../game/types';

interface GameCanvasProps {
  level: LevelConfig;
  screen: GameScreen;
  runKey: number;
  assets: GameAssets;
  inputRef: React.MutableRefObject<InputState>;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onCrash: (snapshot: HudSnapshot) => void;
  onVictory: (snapshot: HudSnapshot) => void;
}

const FIXED_DT = 1 / 120;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  level,
  screen,
  runKey,
  assets,
  inputRef,
  onHudUpdate,
  onCrash,
  onVictory,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<WorldSim>(createWorldSim(level));
  const camRef = useRef<CameraState>(createInitialCamera(simRef.current));
  const screenRef = useRef<GameScreen>(screen);
  const renderTimeRef = useRef<number>(0);
  const callbacksRef = useRef({ onHudUpdate, onCrash, onVictory });

  useEffect(() => {
    screenRef.current = screen;
    if (screen !== 'PLAYING') {
      soundEngine.stopEngine();
    }
  }, [screen]);

  useEffect(() => {
    callbacksRef.current = { onHudUpdate, onCrash, onVictory };
  }, [onHudUpdate, onCrash, onVictory]);

  // Reset simulation whenever level or runKey changes
  useEffect(() => {
    const freshSim = createWorldSim(level);
    simRef.current = freshSim;
    camRef.current = createInitialCamera(freshSim);
    renderTimeRef.current = 0;

    callbacksRef.current.onHudUpdate({
      distanceMeters: 0,
      totalMeters: level.lengthMeters,
      coinsCollected: 0,
      totalCoins: freshSim.coins.length,
      score: 0,
      elapsedSeconds: 0,
      speedKmh: 0,
      flips: 0,
      isReversing: false,
    });
  }, [level, runKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let hudTimer = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const buildSnapshot = (sim: WorldSim): HudSnapshot => {
      const dist = sim.bike.finished
        ? sim.level.lengthMeters
        : Math.max(
            0,
            Math.min(
              sim.level.lengthMeters,
              Math.round((sim.bike.x - sim.level.startX) / PIXELS_PER_METER)
            )
          );
      const collected = sim.coins.reduce((acc, c) => acc + (c.collected ? 1 : 0), 0);
      const speedKmh = sim.bike.finished
        ? 0
        : Math.round((Math.hypot(sim.bike.vx, sim.bike.vy) / PIXELS_PER_METER) * 3.6);
      return {
        distanceMeters: dist,
        totalMeters: sim.level.lengthMeters,
        coinsCollected: collected,
        totalCoins: sim.coins.length,
        score: sim.score,
        elapsedSeconds: sim.elapsedTime,
        speedKmh,
        flips: sim.bike.flipsCompleted,
        isReversing: sim.bike.isReversing,
      };
    };

    const snapStationaryCamera = (
      cam: CameraState,
      sim: WorldSim,
      viewW: number,
      viewH: number
    ) => {
      const isMobilePortrait = viewW < 560;
      const isShortLandscape = viewH < 480 && viewW >= 560;
      let zoom: number;
      if (isMobilePortrait) {
        zoom = Math.max(0.76, Math.min(0.92, viewW / 465));
      } else if (isShortLandscape) {
        zoom = Math.max(0.72, Math.min(0.90, viewH / 470));
      } else if (viewW < 960) {
        zoom = Math.max(0.84, Math.min(1.0, viewW / 860));
      } else {
        zoom = Math.max(0.94, Math.min(1.12, viewW / 1220));
      }
      const worldLookAhead = isMobilePortrait ? 115 : 195;
      cam.x = sim.bike.x + worldLookAhead;
      cam.y = sim.bike.y - (isMobilePortrait ? 10 : 22);
      cam.zoom = zoom;
    };

    const loop = (now: number) => {
      const frameDt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      const sim = simRef.current;
      const cam = camRef.current;
      const currentScreen = screenRef.current;
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;

      if (currentScreen === 'PAUSED') {
        accumulator = 0;
      } else if (
        currentScreen === 'READY' ||
        currentScreen === 'TITLE' ||
        currentScreen === 'LEVEL_SELECT'
      ) {
        accumulator = 0;
        snapStationaryCamera(cam, sim, viewW, viewH);
      } else if (
        currentScreen === 'PLAYING' ||
        currentScreen === 'CRASHED' ||
        currentScreen === 'VICTORY'
      ) {
        renderTimeRef.current += frameDt;
        accumulator += frameDt;
        const activeInput =
          currentScreen === 'PLAYING'
            ? inputRef.current
            : { gas: false, brake: false, leanBack: false, leanForward: false, jump: false };

        while (accumulator >= FIXED_DT) {
          stepWorldSim(sim, activeInput, FIXED_DT, {
            onCoinCollect: (_coin, combo) => soundEngine.playCoin(combo),
            onSpecialCoinCollect: () => soundEngine.playSpecialCoin(),
            onJump: () => soundEngine.playJump(),
            onStunt: () => soundEngine.playStunt(),
            onLand: (intensity) => soundEngine.playLand(intensity),
            onBoost: () => soundEngine.playBoost(),
            onCrash: () => {
              soundEngine.playCrash();
              soundEngine.stopEngine();
              callbacksRef.current.onCrash(buildSnapshot(sim));
            },
            onFinish: () => {
              soundEngine.playVictory();
              soundEngine.stopEngine();
              callbacksRef.current.onVictory(buildSnapshot(sim));
            },
          });
          accumulator -= FIXED_DT;
        }

        if (currentScreen === 'PLAYING' && !sim.bike.crashed && !sim.bike.finished) {
          const speedRatio = Math.hypot(sim.bike.vx, sim.bike.vy) / sim.level.maxSpeed;
          soundEngine.updateEngine(speedRatio, activeInput.gas, true);
        }

        updateCamera(cam, sim, viewW, viewH, frameDt);

        hudTimer += frameDt;
        if (hudTimer >= 0.06) {
          hudTimer = 0;
          callbacksRef.current.onHudUpdate(buildSnapshot(sim));
        }
      }

      renderGameFrame(ctx, sim, cam, assets, viewW, viewH, renderTimeRef.current);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      soundEngine.stopEngine();
    };
  }, [assets, inputRef]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full touch-none select-none"
    />
  );
};
