// The desktop pet's behaviour: a small state machine that walks along the floor, sits, sleeps, follows the pointer, can
// be picked up and dropped, plays with a ball of yarn (cat) and fetches a thrown stick (dog). Pure (the random source is
// passed in) so the rules can be tested.

export type PetState = 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'held' | 'fall' | 'happy' | 'play' | 'carry'
export type PetKind = 'cat' | 'dog'
/** Things the pet did this step that the page must act on: bat the yarn, pick the stick up, put it down. */
export type PetEvent = 'swat' | 'pickup' | 'drop' | null

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
  /** Dog: running to the stick, or carrying it back. */
  fetch: 'none' | 'go' | 'return'
  /** Seconds before it gets interested in a toy again. */
  cool: number
  /** Cat: seconds until the next swat at the yarn. */
  swatIn: number
}

export interface PetContext {
  width: number
  floor: number
  /** Pointer position in window pixels, or null when unknown. */
  pointer: { x: number; y: number } | null
  chase: boolean
  size: number
  rand: () => number
  kind: PetKind
  /** The cat's ball of yarn: where it is and whether it is still rolling. */
  yarn?: { x: number; rolling: boolean } | null
  /** The dog's stick: where it lies and whether it is free (not held by the user and not in the dog's mouth). */
  stick?: { x: number; free: boolean } | null
  /** Where the dog brings the stick: the place it was thrown from. */
  home: number
}

export const PET_GRAVITY = 2200
const WALK_SPEED = 46
const RUN_SPEED = 190

export function makePet(x: number, floor: number): Pet {
  return { x, y: floor, vx: 0, vy: 0, dir: 1, state: 'idle', timer: 2, target: x, fetch: 'none', cool: 0, swatIn: 0 }
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
  pet.fetch = 'none'
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

/** Moves the pet towards x at the given speed; returns true once it has arrived. */
function goTo(pet: Pet, x: number, speed: number, dt: number, ctx: PetContext, reach: number): boolean {
  const half = ctx.size * 0.5
  const gap = x - pet.x
  if (Math.abs(gap) <= reach) return true
  pet.dir = gap > 0 ? 1 : -1
  pet.vx = pet.dir * speed
  pet.x = Math.min(Math.max(pet.x + pet.vx * dt, half), ctx.width - half)
  return false
}

export function stepPet(pet: Pet, dt: number, ctx: PetContext): PetEvent {
  const half = ctx.size * 0.5
  if (pet.state === 'held') return null
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
    return null
  }
  pet.y = ctx.floor
  pet.timer -= dt
  pet.cool = Math.max(0, pet.cool - dt)

  // ---- dog: fetch the stick ----
  if (ctx.kind === 'dog') {
    const stick = ctx.stick
    if (pet.fetch === 'return') {
      pet.state = 'carry'
      if (goTo(pet, ctx.home, RUN_SPEED * 0.85, dt, ctx, ctx.size * 1.1)) {
        pet.fetch = 'none'
        pet.state = 'happy'
        pet.timer = 1.6
        pet.vx = 0
        pet.cool = 5
        return 'drop'
      }
      return null
    }
    if (pet.fetch === 'go') {
      if (!stick || !stick.free) {
        pet.fetch = 'none'
        pet.state = 'idle'
        pet.timer = 0.6
      } else {
        pet.state = 'run'
        if (goTo(pet, stick.x, RUN_SPEED, dt, ctx, ctx.size * 0.4)) {
          pet.fetch = 'return'
          pet.state = 'carry'
          return 'pickup'
        }
        return null
      }
    } else if (stick?.free && pet.cool <= 0 && pet.state !== 'happy') {
      pet.fetch = 'go'
      pet.state = 'run'
      return null
    }
  }

  // ---- cat: play with the yarn ----
  if (ctx.kind === 'cat' && ctx.yarn && pet.cool <= 0 && pet.state !== 'happy' && (pet.state !== 'sleep' || ctx.yarn.rolling)) {
    const gap = ctx.yarn.x - pet.x
    if (Math.abs(gap) > ctx.size * 0.8) {
      pet.state = 'run'
      goTo(pet, ctx.yarn.x, RUN_SPEED, dt, ctx, 0)
      return null
    }
    if (pet.state !== 'play') {
      pet.state = 'play'
      pet.timer = 5 + ctx.rand() * 3
      pet.swatIn = 0.35
      pet.vx = 0
    }
    pet.dir = gap >= 0 ? 1 : -1
    pet.swatIn -= dt
    if (pet.swatIn <= 0) {
      pet.swatIn = 0.7 + ctx.rand() * 0.4
      return 'swat'
    }
    if (pet.timer <= 0) {
      pet.state = 'sit'
      pet.timer = 3
      pet.cool = 9
    }
    return null
  }
  if (pet.state === 'play') {
    pet.state = 'idle'
    pet.timer = 0.5
  }

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
      return null
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
    if (goTo(pet, pet.target, WALK_SPEED, dt, ctx, 4)) {
      pet.state = 'idle'
      pet.timer = 1 + ctx.rand() * 2
      pet.vx = 0
    }
  }
  if (pet.timer <= 0 && (pet.state as PetState) !== 'run') choose(pet, ctx)
  return null
}
