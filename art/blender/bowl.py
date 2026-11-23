import math
import random


def vessel(g, rim_highlight=True, seat=0.039):
    # `seat` lifts the bowl onto the woven floor of the chamber (z ≈ 0.041), keeping 2 mm
    # of overlap. Built from z = 0 it stood 41 mm inside the floor, hiding half of its foot.
    random.seed(271828)
    center_y = 2.0
    azimuth = 112
    closed_columns = azimuth + 1

    # Radius, height, surface region. The contour runs continuously from the
    # underside, around the foot, over the lip, and down the inner wall.
    profile = [
        (0.000, 0.105, "under"),
        (0.120, 0.105, "under"),
        (0.180, 0.100, "under"),
        (0.160, 0.060, "foot"),
        (0.170, 0.020, "foot"),
        (0.200, 0.000, "foot"),
        (0.270, 0.000, "foot"),
        (0.300, 0.025, "foot"),
        (0.290, 0.080, "foot"),
        (0.420, 0.115, "under"),
        (0.600, 0.135, "under"),
        (0.730, 0.205, "outer"),
        (0.840, 0.290, "outer"),
        (0.940, 0.390, "outer"),
        (1.020, 0.490, "outer"),
        (1.080, 0.590, "outer"),
        (1.130, 0.680, "outer"),
        (1.165, 0.735, "outer"),
        (1.180, 0.758, "rim"),
        (1.177, 0.760, "rim"),
        (1.165, 0.758, "rim"),
        (1.145, 0.740, "inner"),
        (1.120, 0.680, "inner"),
        (1.070, 0.590, "inner"),
        (1.010, 0.490, "inner"),
        (0.930, 0.390, "inner"),
        (0.830, 0.290, "inner"),
        (0.705, 0.205, "inner"),
        (0.620, 0.160, "inner"),
        (0.500, 0.145, "inner"),
        (0.340, 0.145, "inner"),
        (0.180, 0.150, "inner"),
        (0.000, 0.160, "inner"),
    ]

    outer_dents = []
    inner_dents = []
    for _ in range(46):
        theta = random.uniform(0.0, math.tau)
        z = random.uniform(0.19, 0.715)
        sigma_theta = random.uniform(0.055, 0.145)
        sigma_z = random.uniform(0.014, 0.043)
        amplitude = random.uniform(0.0015, 0.0048)
        outer_dents.append((theta, z, sigma_theta, sigma_z, amplitude))

    for _ in range(38):
        theta = random.uniform(0.0, math.tau)
        z = random.uniform(0.19, 0.705)
        sigma_theta = random.uniform(0.050, 0.125)
        sigma_z = random.uniform(0.012, 0.035)
        amplitude = random.uniform(0.0011, 0.0038)
        inner_dents.append((theta, z, sigma_theta, sigma_z, amplitude))

    def angle_delta(a, b):
        return (a - b + math.pi) % math.tau - math.pi

    def dent_depth(theta, z, dents):
        depth = 0.0
        for center_theta, center_z, sigma_theta, sigma_z, amplitude in dents:
            dt = angle_delta(theta, center_theta)
            dtheta = dt / sigma_theta
            dz = (z - center_z) / sigma_z
            depth += amplitude * math.exp(-0.5 * (dtheta * dtheta + dz * dz))
        return depth

    # Extra rings carry the hammer facets around the belly in silhouette.
    rings = []
    for first, second in zip(profile, profile[1:]):
        rings.append(first)
        if first[2] == second[2] and first[2] in ('inner', 'outer'):
            rings.append(((first[0] + second[0]) / 2, (first[1] + second[1]) / 2, first[2]))
    profile = rings + [profile[-1]]
    lip_index = next(i for i, item in enumerate(profile) if item[:2] == (1.177, .760))
    rows = []
    rim_points = []

    for row_index, (base_radius, base_z, region) in enumerate(profile):
        row = []
        is_pole = base_radius < 1.0e-8

        for column in range(closed_columns):
            theta = math.tau * (column % azimuth) / azimuth
            radius = base_radius
            z = base_z

            if not is_pole:
                if region == "outer":
                    radius -= 2.8 * dent_depth(theta, z, outer_dents)
                    radius += (
                        0.0014 * math.sin(13.0 * theta + 2.1)
                        + 0.0009 * math.sin(29.0 * theta - 0.7)
                    )
                    z += 0.0012 * math.sin(9.0 * theta + 0.4)
                elif region == "inner":
                    radius += 2.3 * dent_depth(theta, z, inner_dents)
                    radius += (
                        0.0010 * math.sin(11.0 * theta - 1.2)
                        + 0.0006 * math.sin(23.0 * theta + 0.3)
                    )
                    z += 0.0008 * math.sin(8.0 * theta - 0.8)
                elif region == "rim":
                    radius += (
                        0.0023 * math.sin(7.0 * theta + 0.6)
                        + 0.0011 * math.sin(17.0 * theta - 0.5)
                    )
                    z += (
                        0.0027 * math.sin(5.0 * theta + 0.25)
                        + 0.0013 * math.sin(13.0 * theta + 1.1)
                    )

                radius = max(0.0, min(radius, 1.18))
                z = max(0.0, min(z, 0.76))

            x = radius * math.cos(theta)
            y = center_y + radius * math.sin(theta)
            row.append((x, y, z + seat))

            if row_index == lip_index and column < azimuth:
                rim_points.append((x, y, z + seat + 0.0007))

        rows.append(row)

    g.surface("vessel_hammered_bronze", rows, "bronze")

    if rim_highlight and rim_points:
        rim_points.append(rim_points[0])
        g.tube("vessel_rim_highlight", rim_points, 0.0032, "brass")

    return rows
