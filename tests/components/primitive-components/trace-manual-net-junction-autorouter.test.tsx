import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("autorouting preserves a width neck made from joined one-port net traces", async () => {
  const { circuit } = getTestFixture()
  const footprint = (
    <footprint>
      <smtpad portHints={["pin1"]} shape="rect" width={0.6} height={0.6} />
    </footprint>
  )
  circuit.add(
    <board width={30} height={22} minTraceWidth="0.15mm" autorouter="default">
      <chip
        name="E"
        pinLabels={{ pin1: "P" }}
        footprint={footprint}
        pcbX={-8}
        pcbY={7}
      />
      <chip
        name="F"
        pinLabels={{ pin1: "P" }}
        footprint={footprint}
        pcbX={-4}
        pcbY={7}
      />
      <chip
        name="C"
        pinLabels={{ pin1: "P" }}
        footprint={footprint}
        pcbX={-8}
        pcbY={-4}
      />
      <chip
        name="G"
        pinLabels={{ pin1: "P" }}
        footprint={footprint}
        pcbX={0}
        pcbY={7}
      />
      <chip
        name="D"
        pinLabels={{ pin1: "P" }}
        footprint={footprint}
        pcbX={8}
        pcbY={-4}
      />
      <trace
        from="E.pin1"
        to="net.NECK"
        width="0.3mm"
        pcbPath={[{ x: 2, y: 0 }]}
      />
      <trace
        from="F.pin1"
        to="net.NECK"
        width="0.15mm"
        pcbPath={[{ x: -2, y: 0 }]}
      />
      <trace from="C.pin1" to="D.pin1" width="0.15mm" />
      <trace from="G.pin1" to="net.NECK" width="0.3mm" />
    </board>,
  )
  await circuit.renderUntilSettled()
  expect(
    circuit
      .getCircuitJson()
      .filter((element) => element.type.endsWith("_error")),
  ).toEqual([])
  const traces = circuit.db.pcb_trace.list()
  expect(traces).toHaveLength(4)
  const wireRoutes = traces.map((trace) =>
    trace.route
      .filter((point) => point.route_type === "wire")
      .map((point) => [point.x, point.y, point.layer, point.width]),
  )
  expect(wireRoutes).toContainEqual([
    [-8, 7, "top", 0.3],
    [-6, 7, "top", 0.3],
  ])
  expect(wireRoutes).toContainEqual([
    [-4, 7, "top", 0.15],
    [-6, 7, "top", 0.15],
  ])
  const automatic = wireRoutes.find((route) => route[0][1] === -4)!
  expect(automatic[0]).toEqual([-8, -4, "top", 0.15])
  expect(automatic.at(-1)).toEqual([8, -4, "top", 0.15])
  const neckExtension = wireRoutes.find((route) =>
    route.some((point) => point[0] === 0 && point[1] === 7),
  )!
  expect([neckExtension[0], neckExtension.at(-1)]).toContainEqual([
    0,
    7,
    "top",
    0.3,
  ])
  expect([neckExtension[0], neckExtension.at(-1)]).toContainEqual([
    -4,
    7,
    "top",
    0.3,
  ])
  expect(neckExtension.every((point) => Number(point[0]) >= -4)).toBe(true)
})
