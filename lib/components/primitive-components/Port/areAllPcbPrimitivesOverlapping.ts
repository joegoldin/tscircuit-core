import type { PrimitiveComponent } from "lib/components/base-components/PrimitiveComponent"
import type { SmtPad } from "lib/components/primitive-components/SmtPad"
import {
  isRectOverlappingPolygon,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import {
  applyToPoint,
  compose,
  rotateDEG,
  translate,
} from "transformation-matrix"

interface EmittedRect {
  x: number
  y: number
  width: number
  height: number
  ccwRotationDegrees: number
  cornerRadius: number
}

const OVERLAP_TOLERANCE_MM = 1e-9

const getEmittedRect = (
  pcbPrimitive: PrimitiveComponent,
): EmittedRect | null => {
  if (pcbPrimitive.componentName !== "SmtPad") return null
  const smtPadComponent = pcbPrimitive as SmtPad
  const smtPad = smtPadComponent.root?.db.pcb_smtpad.get(
    smtPadComponent.pcb_smtpad_id!,
  )
  if (smtPad?.shape !== "rect" && smtPad?.shape !== "rotated_rect") {
    return null
  }

  return {
    x: smtPad.x,
    y: smtPad.y,
    width: smtPad.width,
    height: smtPad.height,
    ccwRotationDegrees:
      smtPad.shape === "rotated_rect" ? smtPad.ccw_rotation : 0,
    cornerRadius: smtPad.corner_radius ?? 0,
  }
}

const areEmittedRectsOverlapping = (
  firstRect: EmittedRect,
  secondRect: EmittedRect,
): boolean => {
  const firstCornerRadius = Math.min(
    Math.max(firstRect.cornerRadius, 0),
    firstRect.width / 2,
    firstRect.height / 2,
  )
  const secondCornerRadius = Math.min(
    Math.max(secondRect.cornerRadius, 0),
    secondRect.width / 2,
    secondRect.height / 2,
  )
  const firstCoreWidth = firstRect.width - firstCornerRadius * 2
  const firstCoreHeight = firstRect.height - firstCornerRadius * 2
  const secondCoreWidth = secondRect.width - secondCornerRadius * 2
  const secondCoreHeight = secondRect.height - secondCornerRadius * 2

  // A rounded rectangle is its inner rectangular core expanded by its radius.
  // The copper overlaps when the cores overlap or their gap is within both radii.
  const secondCoreCorners = [
    { x: -secondCoreWidth / 2, y: -secondCoreHeight / 2 },
    { x: secondCoreWidth / 2, y: -secondCoreHeight / 2 },
    { x: secondCoreWidth / 2, y: secondCoreHeight / 2 },
    { x: -secondCoreWidth / 2, y: secondCoreHeight / 2 },
  ].map((corner) =>
    applyToPoint(
      compose(
        rotateDEG(-firstRect.ccwRotationDegrees),
        translate(-firstRect.x, -firstRect.y),
        translate(secondRect.x, secondRect.y),
        rotateDEG(secondRect.ccwRotationDegrees),
      ),
      corner,
    ),
  )

  if (
    isRectOverlappingPolygon(
      {
        center: { x: 0, y: 0 },
        width: firstCoreWidth + OVERLAP_TOLERANCE_MM * 2,
        height: firstCoreHeight + OVERLAP_TOLERANCE_MM * 2,
      },
      secondCoreCorners,
    )
  ) {
    return true
  }

  const firstCoreCorners = [
    { x: -firstCoreWidth / 2, y: -firstCoreHeight / 2 },
    { x: firstCoreWidth / 2, y: -firstCoreHeight / 2 },
    { x: firstCoreWidth / 2, y: firstCoreHeight / 2 },
    { x: -firstCoreWidth / 2, y: firstCoreHeight / 2 },
  ]
  const getEdges = (
    corners: Array<{ x: number; y: number }>,
  ): Array<[{ x: number; y: number }, { x: number; y: number }]> =>
    corners.map((corner, cornerIndex) => [
      corner,
      corners[(cornerIndex + 1) % corners.length],
    ])
  const firstCoreEdges = getEdges(firstCoreCorners)
  const secondCoreEdges = getEdges(secondCoreCorners)
  const coreDistance = Math.min(
    ...firstCoreEdges.flatMap(([firstStart, firstEnd]) =>
      secondCoreEdges.map(([secondStart, secondEnd]) =>
        segmentToSegmentMinDistance(
          firstStart,
          firstEnd,
          secondStart,
          secondEnd,
        ),
      ),
    ),
  )

  return (
    coreDistance <=
    firstCornerRadius + secondCornerRadius + OVERLAP_TOLERANCE_MM
  )
}

export const areAllPcbPrimitivesOverlapping = (
  pcbPrimitives: PrimitiveComponent[],
): boolean => {
  if (pcbPrimitives.length <= 1) return true

  // Get bounds of all primitives
  const bounds = pcbPrimitives.map((p) => {
    const circuitBounds = p._getPcbCircuitJsonBounds()
    return {
      left: Math.min(
        circuitBounds.bounds.left,
        circuitBounds.bounds.right,
      ),
      right: Math.max(
        circuitBounds.bounds.left,
        circuitBounds.bounds.right,
      ),
      top: Math.max(circuitBounds.bounds.top, circuitBounds.bounds.bottom),
      bottom: Math.min(
        circuitBounds.bounds.top,
        circuitBounds.bounds.bottom,
      ),
    }
  })
  const layers = pcbPrimitives.map((p) => p.getAvailablePcbLayers())
  const emittedRects = pcbPrimitives.map(getEmittedRect)

  // Build an adjacency matrix representing overlapping primitives
  const overlaps: boolean[][] = Array(bounds.length)
    .fill(false)
    .map(() => Array(bounds.length).fill(false))

  // Fill adjacency matrix
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i]
      const b = bounds[j]

      // Check if bounding boxes overlap
      const shareLayer = layers[i].some((layer) => layers[j].includes(layer))
      const boundsOverlap = !(
        a.right < b.left ||
        a.left > b.right ||
        a.bottom > b.top ||
        a.top < b.bottom
      )
      const firstRect = emittedRects[i]
      const secondRect = emittedRects[j]
      const copperOverlaps =
        firstRect && secondRect
          ? areEmittedRectsOverlapping(firstRect, secondRect)
          : boundsOverlap
      overlaps[i][j] = overlaps[j][i] =
        shareLayer && boundsOverlap && copperOverlaps
    }
  }

  // Use DFS to check if all primitives are connected
  const visited = new Set<number>()
  const dfs = (node: number): void => {
    visited.add(node)
    for (let i = 0; i < bounds.length; i++) {
      if (overlaps[node][i] && !visited.has(i)) {
        dfs(i)
      }
    }
  }

  // Start DFS from first primitive
  dfs(0)

  // Check if all primitives were visited
  return visited.size === bounds.length
}
