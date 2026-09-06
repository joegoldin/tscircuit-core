import { expect, test } from "bun:test"
import type { PcbTrace } from "circuit-json"
import { getSimpleRouteJsonFromCircuitJson } from "lib/utils/autorouting/getSimpleRouteJsonFromCircuitJson"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("SRJ preserves physical manual wire junctions without collapsing disconnected net endpoints", async () => {
  const { circuit } = getTestFixture()
  const footprint = (
    <footprint>
      <smtpad portHints={["pin1"]} shape="rect" width={0.6} height={0.6} />
    </footprint>
  )
  circuit.add(
    <board width={20} height={12} routingDisabled>
      <chip
        name="E"
        pinLabels={{ pin1: "P" }}
        footprint={footprint}
        pcbX={-4}
      />
      <chip name="F" pinLabels={{ pin1: "P" }} footprint={footprint} pcbX={4} />
      <chip name="G" pinLabels={{ pin1: "P" }} footprint={footprint} pcbY={3} />
      <trace
        from="E.pin1"
        to="net.NECK"
        width="0.3mm"
        pcbPath={[{ x: 4, y: 0 }]}
      />
      <trace
        from="F.pin1"
        to="net.NECK"
        width="0.15mm"
        pcbPath={[{ x: -4, y: 0 }]}
      />
      <trace from="G.pin1" to="net.NECK" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const originalCircuitJson = circuit.getCircuitJson()
  const subcircuitId = circuit.db.source_group.list()[0].subcircuit_id
  const neckNet = circuit.db.source_net.getWhere({ name: "NECK" })!
  const [firstTrace, secondTrace] = circuit.db.pcb_trace.list()
  const connectedPorts = [firstTrace, secondTrace]
    .map((trace) => {
      const start = trace.route[0]
      if (start.route_type !== "wire" || !start.start_pcb_port_id) {
        throw new Error("Expected each manual branch to start at a PCB port")
      }
      return start.start_pcb_port_id
    })
    .sort()

  const check = (change?: (traces: PcbTrace[]) => void) => {
    const circuitJson = structuredClone(originalCircuitJson)
    change?.(
      circuitJson.filter(
        (element): element is PcbTrace => element.type === "pcb_trace",
      ),
    )
    const { simpleRouteJson } = getSimpleRouteJsonFromCircuitJson({
      circuitJson,
      subcircuit_id: subcircuitId,
    })
    const connection = simpleRouteJson.connections.find(
      (connection) => connection.name === neckNet.source_net_id,
    )!
    return { simpleRouteJson, connection }
  }

  const joined = check()
  expect(joined.connection.pointsToConnect).toHaveLength(3)
  expect(
    joined.connection.externallyConnectedPointIds?.map((group) =>
      [...group].sort(),
    ),
  ).toEqual([connectedPorts])
  expect(
    joined.simpleRouteJson.traces?.map((trace) =>
      trace.route.map((point) =>
        point.route_type === "wire" ? point.width : null,
      ),
    ),
  ).toEqual([
    [0.3, 0.3],
    [0.15, 0.15],
  ])

  const withSecondEnd = (x: number, y: number) =>
    check((traces) => {
      const end = traces[1].route.at(-1)!
      if (end.route_type !== "wire") throw new Error("Expected a wire endpoint")
      end.x = x
      end.y = y
    }).connection.externallyConnectedPointIds ?? []
  expect(withSecondEnd(0.224, 0)).toEqual([connectedPorts])
  expect(withSecondEnd(0.226, 0)).toEqual([])
  expect(withSecondEnd(-2, 0)).toEqual([connectedPorts])

  const oppositeLayer = check((traces) => {
    for (const point of traces[1].route) {
      if (point.route_type === "wire") point.layer = "bottom"
    }
  })
  expect(oppositeLayer.connection.externallyConnectedPointIds ?? []).toEqual([])

  const unknownNet = check((traces) => {
    traces[1].source_trace_id = undefined
  })
  expect(unknownNet.connection.externallyConnectedPointIds ?? []).toEqual([])
})
