import { expect, test } from "bun:test"
import type { LayerRef, PcbTrace } from "circuit-json"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { getPhysicallyConnectedPcbTracePortGroups } from "lib/utils/autorouting/getPhysicallyConnectedPcbTracePortGroups"

test("physical trace groups are transitive and respect net, layer, and copper boundaries", () => {
  const connMap = new ConnectivityMap({})
  connMap.addConnections([
    ["source_E", "source_F", "source_G", "source_ISOLATED"],
    ["source_OTHER", "other_net"],
  ])
  const trace = (
    name: string,
    points: Array<[number, number]>,
    layer: LayerRef = "top",
    width = 0.15,
  ): PcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: `trace_${name}`,
    source_trace_id: `source_${name}`,
    route: points.map(([x, y], pointIndex) => ({
      route_type: "wire",
      x,
      y,
      layer,
      width,
      ...(pointIndex === 0 ? { start_pcb_port_id: `port_${name}` } : {}),
    })),
  })
  const first = trace(
    "E",
    [
      [-4, 0],
      [-1, 0],
    ],
    "top",
    0.3,
  )
  const second = trace("F", [
    [4, 0],
    [1, 0],
  ])
  const bridge = trace("G", [
    [0, 3],
    [-1, 0],
    [1, 0],
  ])
  const isolated = trace("ISOLATED", [
    [4, 4],
    [2, 4],
  ])
  const foreign = trace("OTHER", [
    [0, -3],
    [0, 0],
  ])
  const groups = (traces: PcbTrace[]) =>
    getPhysicallyConnectedPcbTracePortGroups({ traces, connMap }).map((group) =>
      group.sort(),
    )
  expect(groups([first, second, bridge, isolated, foreign])).toEqual([
    ["port_E", "port_F", "port_G"],
  ])
  expect(groups([bridge, foreign, second, isolated, first])).toEqual([
    ["port_E", "port_F", "port_G"],
  ])
  expect(
    groups([
      first,
      trace(
        "F",
        [
          [-1, 3],
          [-1, 0],
        ],
        "bottom",
      ),
    ]),
  ).toEqual([])
  expect(
    groups([
      first,
      trace("OTHER", [
        [-1, 3],
        [-1, 0],
      ]),
    ]),
  ).toEqual([])
  expect(
    groups([
      first,
      trace("F", [
        [-2, 3],
        [-2, 0.224],
      ]),
    ]),
  ).toEqual([["port_E", "port_F"]])
  expect(
    groups([
      first,
      trace("F", [
        [-2, 3],
        [-2, 0.226],
      ]),
    ]),
  ).toEqual([])
  const tapered = trace(
    "F",
    [
      [-1, 3],
      [-1, 0.3],
    ],
    "top",
    0.5,
  )
  tapered.route_thickness_mode = "interpolated"
  const taperedEnd = tapered.route.at(-1)!
  if (taperedEnd.route_type === "wire") taperedEnd.width = 0.1
  expect(groups([first, tapered])).toEqual([])
  const mixedRoute = trace("F", [
    [-1, 3],
    [-1, 0],
  ])
  mixedRoute.route.push({
    route_type: "via",
    x: -1,
    y: 0,
    from_layer: "top",
    to_layer: "bottom",
  })
  expect(groups([first, mixedRoute])).toEqual([])
})
