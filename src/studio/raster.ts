// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Fatih Erdem. See LICENSE and NOTICE.
/** Browser only: draws an SVG to a PNG (base64, no prefix) at the given size. */
export async function rasterize(svg: string, size = 256): Promise<string> {
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = c.height = size
  const x = c.getContext('2d')!
  x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, size, size)
  return c.toDataURL('image/png').split(',')[1]
}

