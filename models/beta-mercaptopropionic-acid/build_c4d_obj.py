from __future__ import annotations

import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SDF_PATH = ROOT / "beta-mercaptopropionic-acid_CID6514_3d.sdf"
OBJ_PATH = ROOT / "beta-mercaptopropionic-acid_CID6514_ball_and_stick.obj"
MTL_PATH = ROOT / "beta-mercaptopropionic-acid_CID6514_ball_and_stick.mtl"

SCALE = 40.0
SPHERE_SEGMENTS = 32
SPHERE_RINGS = 16
CYLINDER_SEGMENTS = 24
BOND_RADIUS = 0.075 * SCALE
DOUBLE_BOND_OFFSET = 0.115 * SCALE

ATOM_RADII = {
    "H": 0.16 * SCALE,
    "C": 0.33 * SCALE,
    "O": 0.31 * SCALE,
    "S": 0.43 * SCALE,
}

ATOM_MATERIALS = {
    "H": ("Hydrogen_white", (0.94, 0.94, 0.90)),
    "C": ("Carbon_dark_gray", (0.10, 0.11, 0.12)),
    "O": ("Oxygen_red", (0.82, 0.05, 0.04)),
    "S": ("Sulfur_yellow", (0.95, 0.74, 0.10)),
}


def parse_sdf(path: Path):
    lines = path.read_text(encoding="utf-8").splitlines()
    counts = lines[3]
    atom_count = int(counts[0:3])
    bond_count = int(counts[3:6])

    atoms = []
    for line in lines[4 : 4 + atom_count]:
        x = float(line[0:10]) * SCALE
        y = float(line[10:20]) * SCALE
        z = float(line[20:30]) * SCALE
        element = line[31:34].strip()
        atoms.append({"element": element, "pos": (x, y, z)})

    bonds = []
    for line in lines[4 + atom_count : 4 + atom_count + bond_count]:
        bonds.append((int(line[0:3]) - 1, int(line[3:6]) - 1, int(line[6:9])))

    center = tuple(sum(atom["pos"][i] for atom in atoms) / len(atoms) for i in range(3))
    for atom in atoms:
        atom["pos"] = tuple(atom["pos"][i] - center[i] for i in range(3))

    return atoms, bonds


def vec_add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vec_sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec_mul(a, scalar):
    return (a[0] * scalar, a[1] * scalar, a[2] * scalar)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def normalize(v):
    norm = math.sqrt(dot(v, v))
    if norm == 0:
        raise ValueError("zero-length vector")
    return (v[0] / norm, v[1] / norm, v[2] / norm)


def perpendicular_axis(direction):
    reference = (0.0, 0.0, 1.0)
    if abs(dot(direction, reference)) > 0.9:
        reference = (0.0, 1.0, 0.0)
    return normalize(cross(direction, reference))


def add_vertex(vertices, point):
    vertices.append(point)
    return len(vertices)


def add_sphere(vertices, faces, center, radius, material):
    top = add_vertex(vertices, (center[0], center[1], center[2] + radius))
    rings = []

    for ring in range(1, SPHERE_RINGS):
        theta = math.pi * ring / SPHERE_RINGS
        z = center[2] + radius * math.cos(theta)
        ring_radius = radius * math.sin(theta)
        indices = []
        for segment in range(SPHERE_SEGMENTS):
            phi = 2.0 * math.pi * segment / SPHERE_SEGMENTS
            indices.append(
                add_vertex(
                    vertices,
                    (
                        center[0] + ring_radius * math.cos(phi),
                        center[1] + ring_radius * math.sin(phi),
                        z,
                    ),
                )
            )
        rings.append(indices)

    bottom = add_vertex(vertices, (center[0], center[1], center[2] - radius))

    for segment in range(SPHERE_SEGMENTS):
        faces.append((material, [top, rings[0][segment], rings[0][(segment + 1) % SPHERE_SEGMENTS]]))

    for ring_index in range(len(rings) - 1):
        current = rings[ring_index]
        nxt = rings[ring_index + 1]
        for segment in range(SPHERE_SEGMENTS):
            faces.append(
                (
                    material,
                    [
                        current[segment],
                        nxt[segment],
                        nxt[(segment + 1) % SPHERE_SEGMENTS],
                        current[(segment + 1) % SPHERE_SEGMENTS],
                    ],
                )
            )

    for segment in range(SPHERE_SEGMENTS):
        faces.append((material, [rings[-1][segment], bottom, rings[-1][(segment + 1) % SPHERE_SEGMENTS]]))


def add_cylinder(vertices, faces, start, end, radius, material):
    direction = normalize(vec_sub(end, start))
    axis_a = perpendicular_axis(direction)
    axis_b = normalize(cross(direction, axis_a))
    start_ring = []
    end_ring = []

    for segment in range(CYLINDER_SEGMENTS):
        angle = 2.0 * math.pi * segment / CYLINDER_SEGMENTS
        offset = vec_add(
            vec_mul(axis_a, math.cos(angle) * radius),
            vec_mul(axis_b, math.sin(angle) * radius),
        )
        start_ring.append(add_vertex(vertices, vec_add(start, offset)))
        end_ring.append(add_vertex(vertices, vec_add(end, offset)))

    for segment in range(CYLINDER_SEGMENTS):
        faces.append(
            (
                material,
                [
                    start_ring[segment],
                    end_ring[segment],
                    end_ring[(segment + 1) % CYLINDER_SEGMENTS],
                    start_ring[(segment + 1) % CYLINDER_SEGMENTS],
                ],
            )
        )

    start_center = add_vertex(vertices, start)
    end_center = add_vertex(vertices, end)
    for segment in range(CYLINDER_SEGMENTS):
        faces.append((material, [start_center, start_ring[(segment + 1) % CYLINDER_SEGMENTS], start_ring[segment]]))
        faces.append((material, [end_center, end_ring[segment], end_ring[(segment + 1) % CYLINDER_SEGMENTS]]))


def bond_offsets(start, end, order):
    if order <= 1:
        return [(0.0, 0.0, 0.0)]

    axis = perpendicular_axis(normalize(vec_sub(end, start)))
    if order == 2:
        return [vec_mul(axis, -DOUBLE_BOND_OFFSET), vec_mul(axis, DOUBLE_BOND_OFFSET)]
    if order == 3:
        return [(0.0, 0.0, 0.0), vec_mul(axis, -DOUBLE_BOND_OFFSET), vec_mul(axis, DOUBLE_BOND_OFFSET)]
    return [(0.0, 0.0, 0.0)]


def material_for_element(element):
    return ATOM_MATERIALS.get(element, (f"Element_{element}", (0.75, 0.75, 0.75)))[0]


def write_mtl():
    entries = {material: color for material, color in ATOM_MATERIALS.values()}
    entries["Bond_light_gray"] = (0.68, 0.68, 0.66)
    lines = []
    for name, (r, g, b) in entries.items():
        lines.extend(
            [
                f"newmtl {name}",
                f"Kd {r:.4f} {g:.4f} {b:.4f}",
                "Ka 0.0500 0.0500 0.0500",
                "Ks 0.3500 0.3500 0.3500",
                "Ns 64.0000",
                "",
            ]
        )
    MTL_PATH.write_text("\n".join(lines), encoding="utf-8")


def write_obj(vertices, faces):
    lines = [
        "# beta-Mercaptopropionic acid / 3-Mercaptopropionic acid, PubChem CID 6514",
        "# Ball-and-stick model generated from PubChem 3D SDF for Cinema 4D import.",
        f"mtllib {MTL_PATH.name}",
        "o beta_mercaptopropionic_acid_CID6514_ball_and_stick",
        "s 1",
    ]
    lines.extend(f"v {x:.6f} {y:.6f} {z:.6f}" for x, y, z in vertices)

    current_material = None
    for material, indices in faces:
        if material != current_material:
            lines.append(f"usemtl {material}")
            current_material = material
        lines.append("f " + " ".join(str(index) for index in indices))

    OBJ_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    atoms, bonds = parse_sdf(SDF_PATH)
    vertices = []
    faces = []

    for start_index, end_index, order in bonds:
        start = atoms[start_index]["pos"]
        end = atoms[end_index]["pos"]
        for offset in bond_offsets(start, end, order):
            add_cylinder(vertices, faces, vec_add(start, offset), vec_add(end, offset), BOND_RADIUS, "Bond_light_gray")

    for atom in atoms:
        element = atom["element"]
        add_sphere(vertices, faces, atom["pos"], ATOM_RADII.get(element, 0.30 * SCALE), material_for_element(element))

    write_mtl()
    write_obj(vertices, faces)
    print(f"atoms={len(atoms)} bonds={len(bonds)} vertices={len(vertices)} faces={len(faces)}")
    print(OBJ_PATH)
    print(MTL_PATH)


if __name__ == "__main__":
    main()
