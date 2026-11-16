// Turns the point array from perfect-freehand's getStroke() into an SVG path
// "d" string, so it can be filled on a canvas with Path2D.
// This is the standard helper from the perfect-freehand docs/examples.
export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    [] as number[],
  )

  const [firstX, firstY] = stroke[0]
  let path = `M ${firstX},${firstY} Q `

  for (let i = 0; i < d.length; i += 4) {
    path += `${d[i]},${d[i + 1]} ${d[i + 2]},${d[i + 3]} `
  }

  path += 'Z'
  return path
}
