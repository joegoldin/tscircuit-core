import { expect, test } from "bun:test"
import type { CircuitJson, PcbSolderPaste } from "circuit-json"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { asImportedFootprint } from "tests/fixtures/imported-solder-paste"

test("all imported paste shapes follow physical reference pads on both sides and all quarter turns", async () => {
  const shapes = [
    { shape: "circle", radius: 0.3 },
    { shape: "rect", width: 1.2, height: 0.6 },
    { shape: "pill", width: 1.2, height: 0.6, radius: 0.15 },
    { shape: "rotated_rect", width: 1.2, height: 0.6, ccw_rotation: 30 },
    { shape: "rotated_pill", width: 1.2, height: 0.6, radius: 0.15, ccw_rotation: 30 },
    { shape: "oval", width: 1.2, height: 0.6 },
  ] as const
  for (const layer of ["top", "bottom"] as const) {
    for (const rotation of [0, 90, 180, 270]) {
      const { circuit } = getTestFixture()
      const footprint: CircuitJson = shapes.flatMap((shape, index) => {
        const x = index * 2 - 5
        return [
          { type: "pcb_solder_paste", pcb_solder_paste_id: `paste_${index}`, pcb_smtpad_id: `pad_${index}`, x, y: 0.7, layer: "top", ...shape },
          { type: "pcb_smtpad", pcb_smtpad_id: `pad_${index}`, shape: "circle", radius: 0.05, x, y: 0.7, layer: "top", port_hints: [String(index + 1)] },
          ...("ccw_rotation" in shape ? [{
            type: "pcb_smtpad" as const,
            pcb_smtpad_id: `axis_${index}`,
            shape: "circle" as const,
            radius: 0.01,
            x: x + Math.sqrt(3) / 2,
            y: 1.2,
            layer: "top" as const,
            port_hints: [`axis_${index}`],
            is_covered_with_solder_mask: true,
          }] : []),
        ]
      })
      circuit.add(<board width={25} height={25} routingDisabled><chip name="U1" pcbX={3} pcbY={-2} layer={layer} pcbRotation={rotation} footprint={asImportedFootprint(footprint)} /></board>)
      await circuit.renderUntilSettled()
      const pastes = circuit.db.pcb_solder_paste.list()
      expect(pastes).toHaveLength(6)
      for (const [index, input] of shapes.entries()) {
        const pad = circuit.db.pcb_smtpad.list().find((pad) => pad.port_hints?.includes(String(index + 1)))!
        if (pad.shape !== "circle") throw new Error("Expected reference circle")
        const paste = pastes.find((paste) => paste.pcb_smtpad_id === pad.pcb_smtpad_id)!
        expect(paste).toMatchObject({ x: pad.x, y: pad.y, layer: pad.layer, pcb_component_id: pad.pcb_component_id, subcircuit_id: pad.subcircuit_id })
        expect(paste.layer).toBe(layer)
        if (input.shape === "circle") {
          expect(paste).toMatchObject({ shape: "circle", radius: 0.3 })
        } else if ("ccw_rotation" in input) {
          const rotatedPaste = paste as Extract<PcbSolderPaste, { shape: "rotated_rect" | "rotated_pill" }>
          expect(rotatedPaste.shape).toBe(input.shape)
          expect(rotatedPaste.width).toBe(1.2)
          expect(rotatedPaste.height).toBe(0.6)
          expect(((rotatedPaste.ccw_rotation % 180) + 180) % 180).toBeCloseTo(((rotation + (layer === "bottom" ? -30 : 30)) % 180 + 180) % 180, 8)
          const axisPad = circuit.db.pcb_smtpad.list().find((pad) => pad.port_hints?.includes(`axis_${index}`))!
          if (axisPad.shape !== "circle") throw new Error("Expected axis marker")
          const copperAxisAngle = Math.atan2(axisPad.y - pad.y, axisPad.x - pad.x) * 180 / Math.PI
          expect(rotatedPaste.ccw_rotation % 180).toBeCloseTo(((copperAxisAngle % 180) + 180) % 180, 8)
        } else {
          expect(paste).toMatchObject({ shape: input.shape, width: rotation % 180 ? 0.6 : 1.2, height: rotation % 180 ? 1.2 : 0.6 })
        }
        if ("radius" in input) expect(paste).toMatchObject({ radius: input.radius })
      }
    }
  }
})
