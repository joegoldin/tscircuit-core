import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import type { PcbPort, PcbTrace, PcbTraceRoutePoint } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"

type PcbPortId = PcbPort["pcb_port_id"]
type WireRoutePoint = Extract<PcbTraceRoutePoint, { route_type: "wire" }>

const getConstantWidthWireSegments = (trace: PcbTrace) => {
  const firstPoint = trace.route[0]
  if (
    trace.route_thickness_mode === "interpolated" ||
    firstPoint?.route_type !== "wire" ||
    trace.route.some(
      (point) =>
        point.route_type !== "wire" || point.width !== firstPoint.width,
    )
  ) {
    return []
  }
  return trace.route.flatMap((point, pointIndex) => {
    if (point.route_type !== "wire") return []
    const nextPoint = trace.route[pointIndex + 1]
    const end: WireRoutePoint =
      nextPoint?.route_type === "wire" && nextPoint.layer === point.layer
        ? nextPoint
        : point
    return [{ start: point, end, layer: point.layer, width: point.width }]
  })
}

/**
 * Groups annotated PCB ports joined by existing traces and touching same-net,
 * constant-width wire-only copper. Other route kinds retain their explicitly
 * annotated port groups without adding geometry-based connections.
 * Points are circuit-world positions in mm: a right-handed frame
 * with +X right, +Y up the board and +Z above its top copper layer.
 * Electrical net membership alone never establishes a physical connection.
 */
export const getPhysicallyConnectedPcbTracePortGroups = ({
  traces,
  connMap,
}: {
  traces: PcbTrace[]
  connMap: Pick<ConnectivityMap, "getNetConnectedToId">
}): PcbPortId[][] => {
  const traceCopper = traces.map((trace) => ({
    net: trace.source_trace_id
      ? connMap.getNetConnectedToId(trace.source_trace_id)
      : undefined,
    segments: getConstantWidthWireSegments(trace),
    portIds: new Set(
      trace.route.flatMap((point) =>
        point.route_type === "wire"
          ? [point.start_pcb_port_id, point.end_pcb_port_id].filter(
              (portId): portId is PcbPortId => portId !== undefined,
            )
          : [],
      ),
    ),
  }))
  const parents = traces.map((_, traceIndex) => traceIndex)
  const findRoot = (traceIndex: number): number => {
    while (parents[traceIndex] !== traceIndex) {
      parents[traceIndex] = parents[parents[traceIndex]]
      traceIndex = parents[traceIndex]
    }
    return traceIndex
  }

  for (let firstIndex = 0; firstIndex < traceCopper.length; firstIndex++) {
    const first = traceCopper[firstIndex]
    if (!first.net) continue
    for (let secondIndex = 0; secondIndex < firstIndex; secondIndex++) {
      const second = traceCopper[secondIndex]
      if (first.net !== second.net) continue
      const firstRoot = findRoot(firstIndex)
      const secondRoot = findRoot(secondIndex)
      if (firstRoot === secondRoot) continue

      const copperTouches = first.segments.some((firstSegment) =>
        second.segments.some(
          (secondSegment) =>
            firstSegment.layer === secondSegment.layer &&
            segmentToSegmentMinDistance(
              firstSegment.start,
              firstSegment.end,
              secondSegment.start,
              secondSegment.end,
            ) <=
              (firstSegment.width + secondSegment.width) / 2,
        ),
      )
      if (copperTouches) parents[firstRoot] = secondRoot
    }
  }

  const portIdsByRoot = new Map<number, Set<PcbPortId>>()
  for (let traceIndex = 0; traceIndex < traceCopper.length; traceIndex++) {
    const root = findRoot(traceIndex)
    const portIds = portIdsByRoot.get(root) ?? new Set<PcbPortId>()
    for (const portId of traceCopper[traceIndex].portIds) portIds.add(portId)
    portIdsByRoot.set(root, portIds)
  }
  return [...portIdsByRoot.values()]
    .filter((portIds) => portIds.size >= 2)
    .map((portIds) => [...portIds])
}
