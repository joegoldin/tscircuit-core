import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("testpoint preserves explicit do-not-place source intent", async () => {
  const { circuit } = getTestFixture()
  circuit.add(
    <board width="12mm" height="8mm" routingDisabled>
      <testpoint name="TP1" footprintVariant="pad" pcbX={-3} />
      <testpoint
        name="TP2"
        footprintVariant="pad"
        pcbX={0}
        doNotPlace={false}
      />
      <testpoint
        name="TP3"
        footprintVariant="pad"
        pcbX={3}
        doNotPlace
      />
      <trace from="TP1.pin1" to="net.ONE" />
      <trace from="TP2.pin1" to="net.TWO" />
      <trace from="TP3.pin1" to="net.THREE" />
    </board>,
  )

  await circuit.renderUntilSettled()

  const sourceComponents = circuit.db.source_component
    .list()
    .filter((component) => component.ftype === "simple_test_point")
    .sort((a, b) => a.name.localeCompare(b.name))
  expect(
    sourceComponents.map(
      (component) =>
        (component as typeof component & { do_not_place?: boolean })
          .do_not_place,
    ),
  ).toEqual([false, false, true])

  for (const [index, sourceComponent] of sourceComponents.entries()) {
    const sourcePort = circuit.db.source_port.getWhere({
      source_component_id: sourceComponent.source_component_id,
    })
    const pcbComponent = circuit.db.pcb_component.getWhere({
      source_component_id: sourceComponent.source_component_id,
    })
    const pcbPort = circuit.db.pcb_port.getWhere({
      source_port_id: sourcePort!.source_port_id,
    })
    const pad = circuit.db.pcb_smtpad.getWhere({
      pcb_component_id: pcbComponent!.pcb_component_id,
    })
    if (!pad) throw new Error(`Missing pad for ${sourceComponent.name}`)
    const trace = circuit.db.source_trace
      .list()
      .find((candidate) =>
        candidate.connected_source_port_ids.includes(sourcePort!.source_port_id),
      )
    const net = circuit.db.source_net.get(trace!.connected_source_net_ids[0]!)

    expect({
      sourcePin: sourcePort!.pin_number,
      pcbLayers: pcbPort!.layers,
      padShape: pad!.shape,
      padRadius: pad!.shape === "circle" ? pad.radius : undefined,
      net: net!.name,
      pcbDoNotPlace: pcbComponent!.do_not_place,
    }).toEqual({
      sourcePin: 1,
      pcbLayers: ["top"],
      padShape: "circle",
      padRadius: 0.6,
      net: ["ONE", "TWO", "THREE"][index],
      pcbDoNotPlace: index === 2,
    })
  }
})
