// The desktop pet's behaviour: a small state machine that walks along the floor, sits, sleeps, follows the pointer and
// can be picked up and dropped. Pure (the random source is passed in) so the rules can be tested.

export type PetState = 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'held' | 'fall' | 'happy'
export type PetKind = 'cat' | 'dog' | 'rabbit'

export interface Pet {
  /** Horizontal centre and the y of the feet. */
  x: number
  y: number
  vx: number
  vy: number
  dir: 1 | -1
  state: PetState
  /** Seconds left in the current state. */
  timer: number
  /** Where a walk is heading. */
  target: number
}

export interface PetContext {
  width: number
  floor: number
  /** Pointer position in window pixels, or null when unknown. */
  pointer: { x: number; y: number } | null
  chase: boolean
  size: number
  rand: () => number
}

export const PET_GRAVITY = 2200
const WALK_SPEED = 46
const RUN_SPEED = 190

export function makePet(x: number, floor: number): Pet {
  return { x, y: floor, vx: 0, vy: 0, dir: 1, state: 'idle', timer: 2, target: x }
}

function choose(pet: Pet, ctx: PetContext) {
  const r = ctx.rand()
  if (r < 0.5) {
    pet.state = 'walk'
    const margin = ctx.size
    pet.target = margin + ctx.rand() * Math.max(1, ctx.width - margin * 2)
    pet.dir = pet.target >= pet.x ? 1 : -1
    pet.timer = 12
  } else if (r < 0.75) {
    pet.state = 'sit'
    pet.timer = 3 + ctx.rand() * 4
  } else if (r < 0.9) {
    pet.state = 'sleep'
    pet.timer = 8 + ctx.rand() * 8
  } else {
    pet.state = 'idle'
    pet.timer = 1 + ctx.rand() * 2
  }
  pet.vx = 0
}

export function pickUp(pet: Pet) {
  pet.state = 'held'
  pet.vx = 0
  pet.vy = 0
}

export function drop(pet: Pet, vx: number, vy: number) {
  pet.state = 'fall'
  pet.vx = vx
  pet.vy = vy
}

export function stroke(pet: Pet) {
  if (pet.state === 'held' || pet.state === 'fall') return
  pet.state = 'happy'
  pet.timer = 1.6
  pet.vx = 0
}

export function stepPet(pet: Pet, dt: number, ctx: PetContext) {
  const half = ctx.size * 0.5
  if (pet.state === 'held') return
  if (pet.state === 'fall') {
    pet.vy += PET_GRAVITY * dt
    pet.x += pet.vx * dt
    pet.y += pet.vy * dt
    pet.vx *= 1 - Math.min(1, 0.8 * dt)
    if (pet.x < half) {
      pet.x = half
      pet.vx = Math.abs(pet.vx) * 0.4
    }
    if (pet.x > ctx.width - half) {
      pet.x = ctx.width - half
      pet.vx = -Math.abs(pet.vx) * 0.4
    }
    if (pet.y >= ctx.floor) {
      pet.y = ctx.floor
      if (pet.vy > 420) pet.vy = -pet.vy * 0.28
      else {
        pet.state = 'idle'
        pet.timer = 1.2
        pet.vx = 0
        pet.vy = 0
      }
    }
    return
  }
  pet.y = ctx.floor
  pet.timer -= dt

  // the pointer near the floor wakes a sleeper and, if the pet likes company, calls it over
  const p = ctx.pointer
  const near = p && Math.abs(p.x - pet.x) < ctx.size * 2 && p.y > ctx.floor - ctx.size * 2.5
  if (pet.state === 'sleep' && near) {
    pet.state = 'idle'
    pet.timer = 0.8
  }
  if (ctx.chase && p && pet.state !== 'happy' && p.y > ctx.floor - ctx.size * 3) {
    const gap = p.x - pet.x
    if (Math.abs(gap) > ctx.size * 0.9 && Math.abs(gap) < ctx.width) {
      pet.state = 'run'
      pet.dir = gap > 0 ? 1 : -1
      pet.vx = pet.dir * RUN_SPEED
      pet.x = Math.min(Math.max(pet.x + pet.vx * dt, half), ctx.width - half)
      pet.timer = 1
      return
    }
    if (pet.state === 'run') {
      pet.state = 'sit'
      pet.timer = 2 + ctx.rand() * 2
      pet.vx = 0
    }
  } else if (pet.state === 'run') {
    pet.state = 'idle'
    pet.timer = 0.5
    pet.vx = 0
  }

  if (pet.state === 'walk') {
    const gap = pet.target - pet.x
    if (Math.abs(gap) < 4) {
      pet.state = 'idle'
      pet.timer = 1 + ctx.rand() * 2
      pet.vx = 0
    } else {
      pet.dir = gap > 0 ? 1 : -1
      pet.vx = pet.dir * WALK_SPEED
      pet.x = Math.min(Math.max(pet.x + pet.vx * dt, half), ctx.width - half)
    }
  }
  if (pet.timer <= 0 && (pet.state as PetState) !== 'run') choose(pet, ctx)
}
