import React, { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Clock,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  RotateCw,
  Gauge,
  OctagonX,
} from 'lucide-react';
import { COIN_IMAGE_PATH } from '../game/assets';
import { HudSnapshot, InputState, LevelConfig } from '../game/types';

interface GameHUDProps {
  level: LevelConfig;
  username: string;
  hud: HudSnapshot;
  muted: boolean;
  isReady?: boolean;
  inputState: InputState;
  onBack: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onPause: () => void;
  onControlChange: (key: keyof InputState, active: boolean) => void;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  level,
  username,
  hud,
  muted,
  isReady = false,
  inputState,
  onBack,
  onToggleMute,
  onRestart,
  onPause,
  onControlChange,
}) => {
  const activePointersRef = useRef<Record<keyof InputState, Set<number>>>({
    gas: new Set(),
    brake: new Set(),
    leanBack: new Set(),
    leanForward: new Set(),
    jump: new Set(),
  });

  useEffect(() => {
    const pointers = activePointersRef.current;
    return () => {
      (Object.keys(pointers) as (keyof InputState)[]).forEach((k) => {
        pointers[k].clear();
      });
    };
  }, []);

  const progressPct = Math.max(
    0,
    Math.min(100, (hud.distanceMeters / Math.max(1, hud.totalMeters)) * 100)
  );

  const releasePointer = (key: keyof InputState, pointerId: number) => {
    const set = activePointersRef.current[key];
    if (set.has(pointerId)) {
      set.delete(pointerId);
    }
    if (set.size === 0) {
      onControlChange(key, false);
    }
  };

  const bindPointer = (key: keyof InputState) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      activePointersRef.current[key].add(e.pointerId);
      onControlChange(key, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore if already released
      }
      releasePointer(key, e.pointerId);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      releasePointer(key, e.pointerId);
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      releasePointer(key, e.pointerId);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => {
      try {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
          releasePointer(key, e.pointerId);
        }
      } catch {
        releasePointer(key, e.pointerId);
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between px-2.5 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:p-5">
      {/* Top HUD Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-white/15 bg-[#0B0F14]/88 px-3 py-2.5 backdrop-blur-md sm:gap-4 sm:px-4 sm:py-3">
        {/* Left: Back Button, Welcome Greeting, Level & Distance Progress */}
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to level select"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-900/95 text-slate-100 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:h-14 sm:w-14"
          >
            <ArrowLeft className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
          </button>

          <div className="min-w-0">
            <div className="truncate text-xs font-extrabold text-white sm:text-sm">
              Welcome, <span className="text-emerald-400">{username}</span>!
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 sm:text-sm">
              <span className="whitespace-nowrap text-emerald-300">Lvl {level.id}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="truncate text-slate-100">{level.name}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-800 sm:w-36 md:w-44">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-transform duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="font-mono text-xs font-bold text-slate-200 tabular-nums whitespace-nowrap sm:text-sm">
                {hud.distanceMeters}m / {hud.totalMeters}m
              </span>
            </div>
          </div>
        </div>

        {/* Center / Row 2 on Mobile: Enlarged EarnOS Coins, Score & Timer */}
        <div className="order-3 flex w-full items-center justify-around gap-3 border-t border-white/10 pt-2 sm:order-2 sm:w-auto sm:justify-start sm:gap-5 sm:border-t-0 sm:pt-0">
          {/* EarnOS Coin Counter */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-slate-100 bg-black shadow-sm sm:h-10 sm:w-10">
              <img
                src={COIN_IMAGE_PATH}
                alt="EarnOS Coin"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="font-mono text-lg font-extrabold text-white tabular-nums whitespace-nowrap sm:text-xl">
              {hud.coinsCollected}
              <span className="text-sm font-semibold text-slate-400">
                /{hud.totalCoins}
              </span>
            </span>
          </div>

          <div className="h-6 w-px bg-white/15" />

          {/* Score & Points Counter */}
          <div className="flex items-baseline gap-1.5 font-mono tabular-nums whitespace-nowrap">
            <span className="text-lg font-black text-amber-300 sm:text-xl">
              {hud.score}
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wide text-emerald-400 sm:text-sm">
              pts
            </span>
          </div>

          <div className="h-6 w-px bg-white/15" />

          {/* Timer & Reverse Status Indicator */}
          <div className="flex items-center gap-2 font-mono text-base font-extrabold text-slate-100 tabular-nums whitespace-nowrap sm:text-lg">
            <Clock className="h-5 w-5 text-emerald-400" strokeWidth={2.4} />
            <span>{formatTime(hud.elapsedSeconds)}</span>
            {hud.isReversing && (
              <span className="ml-1 rounded bg-amber-400 px-1.5 py-0.5 text-xs font-black tracking-wide text-slate-950">
                REV
              </span>
            )}
          </div>
        </div>

        {/* Right: Enlarged Sound, Restart & Pause Buttons */}
        <div className="order-2 flex items-center gap-2 sm:order-3 sm:gap-2.5">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-slate-900/95 text-slate-100 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:h-14 sm:w-14"
          >
            {muted ? (
              <VolumeX className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.3} />
            ) : (
              <Volume2 className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.3} />
            )}
          </button>
          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart level"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-slate-900/95 text-slate-100 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:h-14 sm:w-14"
          >
            <RotateCcw className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.3} />
          </button>
          <button
            type="button"
            onClick={onPause}
            disabled={isReady}
            aria-label="Pause game"
            className={`flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/45 bg-emerald-500/20 text-emerald-200 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400 sm:h-14 sm:w-14 ${
              isReady
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-emerald-500/35 hover:text-white active:scale-95'
            }`}
          >
            <Pause className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.3} />
          </button>
        </div>
      </div>

      {/* Bottom Mobile Controls: Hidden until START is pressed */}
      {!isReady && (
      <div className="flex items-end justify-between gap-3 pb-1 sm:gap-4 sm:pb-2">
        {/* Left Cluster: Brake centered above Tilt Back & Tilt Forward */}
        <div className="pointer-events-auto flex flex-col items-center gap-2 sm:gap-3">
          {/* Brake Button Centered Above Both Tilt Buttons */}
          <button
            type="button"
            {...bindPointer('brake')}
            aria-label="Brake"
            className={`touch-control flex h-[clamp(66px,12vh,108px)] w-[clamp(112px,28vw,160px)] flex-col items-center justify-center rounded-2xl border-2 px-3 transition-transform ${
              inputState.brake
                ? 'scale-95 border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-500/40'
                : 'border-rose-400/60 bg-rose-500/25 text-rose-100 hover:bg-rose-500/35'
            } backdrop-blur-md`}
          >
            <OctagonX className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.5} />
            <span className="mt-1 text-center text-sm font-extrabold leading-tight tracking-tight sm:text-base">
              Brake
            </span>
          </button>

          {/* Bottom Left Pair: Tilt Back & Tilt Forward */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              type="button"
              {...bindPointer('leanBack')}
              aria-label="Tilt Back"
              className={`touch-control flex h-[clamp(72px,13vh,116px)] w-[clamp(82px,23.5vw,144px)] flex-col items-center justify-center rounded-2xl border-2 px-2 transition-transform ${
                inputState.leanBack
                  ? 'scale-95 border-emerald-300 bg-emerald-500/45 text-white shadow-lg shadow-emerald-500/25'
                  : 'border-white/20 bg-[#0B0F14]/82 text-slate-100 hover:bg-slate-900/95'
              } backdrop-blur-md`}
            >
              <RotateCcw className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.5} />
              <span className="mt-1 text-center text-xs font-extrabold leading-tight tracking-tight sm:text-sm">
                Tilt Back
              </span>
            </button>

            <button
              type="button"
              {...bindPointer('leanForward')}
              aria-label="Tilt Forward"
              className={`touch-control flex h-[clamp(72px,13vh,116px)] w-[clamp(82px,23.5vw,144px)] flex-col items-center justify-center rounded-2xl border-2 px-2 transition-transform ${
                inputState.leanForward
                  ? 'scale-95 border-emerald-300 bg-emerald-500/45 text-white shadow-lg shadow-emerald-500/25'
                  : 'border-white/20 bg-[#0B0F14]/82 text-slate-100 hover:bg-slate-900/95'
              } backdrop-blur-md`}
            >
              <RotateCw className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.5} />
              <span className="mt-1 text-center text-xs font-extrabold leading-tight tracking-tight sm:text-sm">
                Tilt Forward
              </span>
            </button>
          </div>
        </div>

        {/* Center Keyboard Legend (desktop only) */}
        <div className="hidden flex-col items-center gap-1 rounded-lg bg-[#0B0F14]/65 px-3.5 py-1.5 text-xs text-slate-300 backdrop-blur-sm lg:flex">
          {hud.isReversing && (
            <span className="font-mono font-black tracking-wider text-amber-300">
              REVERSING
            </span>
          )}
          <div className="flex items-center gap-3">
            <span>W / ↑ Gas</span>
            <span className="text-slate-600">·</span>
            <span>S / ↓ Brake / Rev</span>
            <span className="text-slate-600">·</span>
            <span>Space Jump</span>
            <span className="text-slate-600">·</span>
            <span>A / D Tilt</span>
          </div>
        </div>

        {/* Right Side: Dedicated JUMP Button Above Large Gas Pedal */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 sm:gap-3">
          <button
            type="button"
            {...bindPointer('jump')}
            aria-label="Jump"
            className={`touch-control flex h-[clamp(64px,11.5vh,104px)] w-[clamp(96px,27vw,172px)] flex-col items-center justify-center rounded-2xl border-2 px-3 transition-transform ${
              inputState.jump
                ? 'scale-95 border-amber-200 bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/40'
                : 'border-amber-400/70 bg-amber-500/25 text-amber-200 hover:bg-amber-500/35'
            } backdrop-blur-md`}
          >
            <ArrowUp className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.75} />
            <span className="mt-0.5 text-center text-sm font-black leading-tight tracking-tight sm:text-base">
              JUMP
            </span>
          </button>

          <button
            type="button"
            {...bindPointer('gas')}
            aria-label="Gas"
            className={`touch-control flex h-[clamp(78px,14.5vh,124px)] w-[clamp(96px,27vw,172px)] flex-col items-center justify-center rounded-2xl border-2 px-3 transition-transform ${
              inputState.gas
                ? 'scale-95 border-emerald-200 bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40'
                : 'border-emerald-400/65 bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/35'
            } backdrop-blur-md`}
          >
            <Gauge className="h-9 w-9 sm:h-12 sm:w-12" strokeWidth={2.5} />
            <span className="mt-1 text-center text-base font-black leading-tight tracking-tight sm:text-xl">
              Gas
            </span>
          </button>
        </div>
      </div>
      )}
    </div>
  );
};
