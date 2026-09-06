import type { PrimitiveComponent } from "lib/components/base-components/PrimitiveComponent"
import type { PlatedHole } from "lib/components/primitive-components/PlatedHole"
import type { SmtPad } from "lib/components/primitive-components/SmtPad"
import type { LayerRef, PcbPlatedHole, PcbSmtPad } from "circuit-json"
import {
  distance,
  isPointInsidePolygon,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"
import {
  applyToPoint,
  compose,
  rotateDEG,
  translate,
} from "transformation-matrix"

const POINT_TOLERANCE_MM = 1e-9

const isPointInRotatedRect = (
  point: { x: number; y: number },
  rect: {
    x: number
    y: number
    width: number
    height: number
    cornerRadius?: number
    ccwRotationDegrees: number
  },
): boolean => {
  const localPoint = applyToPoint(
    compose(
      rotateDEG(-rect.ccwRotationDegrees),
      translate(-rect.x, -rect.y),
    ),
    point,
  )
  const halfWidth = rect.width / 2
  const halfHeight = rect.height / 2
  const cornerRadius = Math.min(
    rect.cornerRadius ?? 0,
    halfWidth,
    halfHeight,
  )
  const cornerDistanceX = Math.max(
    Math.abs(localPoint.x) - (halfWidth - cornerRadius),
    0,
  )
  const cornerDistanceY = Math.max(
    Math.abs(localPoint.y) - (halfHeight - cornerRadius),
    0,
  )
  return (
    cornerDistanceX ** 2 + cornerDistanceY ** 2 <=
    (cornerRadius + POINT_TOLERANCE_MM) ** 2
  )
}

const isPointInCircle = (
  point: { x: number; y: number },
  circle: { x: number; y: number; radius: number },
): boolean =>
  distance(point, circle) <= circle.radius + POINT_TOLERANCE_MM

const isPointInPill = (
  point: { x: number; y: number },
  pill: {
    x: number
    y: number
    width: number
    height: number
    radius?: number
    ccwRotationDegrees: number
  },
): boolean => {
  const localPoint = applyToPoint(
    compose(
      rotateDEG(-pill.ccwRotationDegrees),
      translate(-pill.x, -pill.y),
    ),
    point,
  )
  const radius = pill.radius ?? Math.min(pill.width, pill.height) / 2
  const horizontal = pill.width >= pill.height
  const segmentHalfLength =
    (horizontal ? pill.width : pill.height) / 2 - radius
  const segmentStart = horizontal
    ? { x: -segmentHalfLength, y: 0 }
    : { x: 0, y: -segmentHalfLength }
  const segmentEnd = horizontal
    ? { x: segmentHalfLength, y: 0 }
    : { x: 0, y: segmentHalfLength }

  return (
    pointToSegmentDistance(localPoint, segmentStart, segmentEnd) <=
    radius + POINT_TOLERANCE_MM
  )
}

const isPointSupportedBySmtPad = (
  point: { x: number; y: number },
  smtPad: PcbSmtPad,
): boolean => {
  if (smtPad.shape === "polygon") {
    return isPointInsidePolygon(point, smtPad.points)
  }

  if (smtPad.shape === "circle") {
    return isPointInCircle(point, {
      x: smtPad.x,
      y: smtPad.y,
      radius: smtPad.radius,
    })
  }

  if (smtPad.shape === "pill" || smtPad.shape === "rotated_pill") {
    return isPointInRotatedRect(point, {
      x: smtPad.x,
      y: smtPad.y,
      width: smtPad.width,
      height: smtPad.height,
      cornerRadius: smtPad.radius,
      ccwRotationDegrees:
        smtPad.shape === "rotated_pill" ? smtPad.ccw_rotation : 0,
    })
  }

  return isPointInRotatedRect(point, {
    x: smtPad.x,
    y: smtPad.y,
    width: smtPad.width,
    height: smtPad.height,
    cornerRadius: smtPad.corner_radius,
    ccwRotationDegrees:
      smtPad.shape === "rotated_rect" ? smtPad.ccw_rotation : 0,
  })
}

const isPointSupportedByPlatedHole = (
  point: { x: number; y: number },
  platedHole: PcbPlatedHole,
): boolean => {
  if (
    Math.abs(point.x - platedHole.x) <= POINT_TOLERANCE_MM &&
    Math.abs(point.y - platedHole.y) <= POINT_TOLERANCE_MM
  ) {
    return true
  }

  if (platedHole.shape === "circle") {
    return isPointInCircle(point, {
      x: platedHole.x,
      y: platedHole.y,
      radius: platedHole.outer_diameter / 2,
    })
  }

  if (platedHole.shape === "pill" || platedHole.shape === "oval") {
    return isPointInPill(point, {
      x: platedHole.x,
      y: platedHole.y,
      width: platedHole.outer_width,
      height: platedHole.outer_height,
      ccwRotationDegrees: platedHole.ccw_rotation ?? 0,
    })
  }

  if (platedHole.shape === "hole_with_polygon_pad") {
    return isPointInsidePolygon(
      point,
      platedHole.pad_outline.map((padPoint) => ({
        x: platedHole.x + padPoint.x,
        y: platedHole.y + padPoint.y,
      })),
    )
  }

  if (!("rect_pad_width" in platedHole)) return false

  return isPointInRotatedRect(point, {
    x: platedHole.x,
    y: platedHole.y,
    width: platedHole.rect_pad_width,
    height: platedHole.rect_pad_height,
    cornerRadius: platedHole.rect_border_radius,
    ccwRotationDegrees:
      "rect_ccw_rotation" in platedHole
        ? (platedHole.rect_ccw_rotation ?? 0)
        : 0,
  })
}

/**
 * Tests a board-world point, in millimeters with +Y up, against emitted copper.
 */
const isPointSupportedByPcbPrimitive = (
  point: { x: number; y: number },
  pcbPrimitive: PrimitiveComponent,
): boolean => {
  if (pcbPrimitive.componentName === "PlatedHole") {
    const platedHoleComponent = pcbPrimitive as PlatedHole
    const platedHole = platedHoleComponent.root?.db.pcb_plated_hole.get(
      platedHoleComponent.pcb_plated_hole_id!,
    )
    return platedHole
      ? isPointSupportedByPlatedHole(point, platedHole)
      : false
  }

  if (pcbPrimitive.componentName !== "SmtPad") {
    const center = pcbPrimitive._getPcbCircuitJsonBounds().center
    return (
      Math.abs(point.x - center.x) <= POINT_TOLERANCE_MM &&
      Math.abs(point.y - center.y) <= POINT_TOLERANCE_MM
    )
  }

  const smtPadComponent = pcbPrimitive as SmtPad
  const smtPad = smtPadComponent.root?.db.pcb_smtpad.get(
    smtPadComponent.pcb_smtpad_id!,
  )
  if (!smtPad) return false

  return isPointSupportedBySmtPad(point, smtPad)
}

const getSupportedCandidatePoints = (
  pcbPrimitive: PrimitiveComponent,
): Array<{ x: number; y: number }> => {
  const center = pcbPrimitive._getPcbCircuitJsonBounds().center
  if (pcbPrimitive.componentName === "PlatedHole") {
    const platedHoleComponent = pcbPrimitive as PlatedHole
    const platedHole = platedHoleComponent.root?.db.pcb_plated_hole.get(
      platedHoleComponent.pcb_plated_hole_id!,
    )
    if (platedHole?.shape === "hole_with_polygon_pad") {
      return [
        center,
        ...platedHole.pad_outline.map((padPoint) => ({
          x: platedHole.x + padPoint.x,
          y: platedHole.y + padPoint.y,
        })),
      ]
    }
    return [center]
  }

  if (pcbPrimitive.componentName !== "SmtPad") return [center]

  const smtPadComponent = pcbPrimitive as SmtPad
  const smtPad = smtPadComponent.root?.db.pcb_smtpad.get(
    smtPadComponent.pcb_smtpad_id!,
  )
  if (smtPad?.shape === "polygon") return [center, ...smtPad.points]

  return [center]
}

export const getCenterOfPcbPrimitives = (
  pcbPrimitives: PrimitiveComponent[],
  compatibleLayers?: LayerRef[],
): { x: number; y: number } => {
  if (pcbPrimitives.length === 0) {
    throw new Error("Cannot get center of empty PCB primitives array")
  }

  const positions = pcbPrimitives
    .map((p) => p._getPcbCircuitJsonBounds().center)
    .filter(Boolean)

  const sumX = positions.reduce((sum, pos) => sum + pos.x, 0)
  const sumY = positions.reduce((sum, pos) => sum + pos.y, 0)
  const mean = {
    x: sumX / positions.length,
    y: sumY / positions.length,
  }
  const stablePositions = positions.toSorted(
    (positionA, positionB) =>
      positionA.x - positionB.x || positionA.y - positionB.y,
  )
  const stableMean = {
    x:
      stablePositions.reduce((sum, position) => sum + position.x, 0) /
      stablePositions.length,
    y:
      stablePositions.reduce((sum, position) => sum + position.y, 0) /
      stablePositions.length,
  }
  const compatiblePrimitives = compatibleLayers
    ? pcbPrimitives.filter((pcbPrimitive) =>
        pcbPrimitive
          .getAvailablePcbLayers()
          .some((layer) => compatibleLayers.includes(layer as LayerRef)),
      )
    : pcbPrimitives

  if (compatiblePrimitives.length === 0) {
    throw new Error("PCB port has no primitive on a compatible layer")
  }

  if (
    compatiblePrimitives.some((pcbPrimitive) =>
      isPointSupportedByPcbPrimitive(mean, pcbPrimitive),
    )
  ) {
    return mean
  }

  const supportedCenters = compatiblePrimitives
    .flatMap((pcbPrimitive) =>
      getSupportedCandidatePoints(pcbPrimitive).filter((candidatePoint) =>
        isPointSupportedByPcbPrimitive(candidatePoint, pcbPrimitive),
      ),
    )
    .toSorted((centerA, centerB) => {
      const distanceFromMeanA =
        (centerA.x - stableMean.x) ** 2 +
        (centerA.y - stableMean.y) ** 2
      const distanceFromMeanB =
        (centerB.x - stableMean.x) ** 2 +
        (centerB.y - stableMean.y) ** 2
      return (
        distanceFromMeanA - distanceFromMeanB ||
        centerA.x - centerB.x ||
        centerA.y - centerB.y
      )
    })

  const supportedCenter = supportedCenters[0]
  if (!supportedCenter) {
    throw new Error("Cannot place PCB port on supported copper")
  }
  return supportedCenter
}
