import math


def folds(g):
    def clamp(v, lo=0.0, hi=1.0):
        return lo if v < lo else hi if v > hi else v

    def smoothstep(a, b, v):
        t = clamp((v - a) / (b - a))
        return t * t * (3.0 - 2.0 * t)

    def hash01(ix, iy):
        n = (ix * 374761393 + iy * 668265263) & 0xFFFFFFFF
        n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
        n ^= n >> 16
        return (n & 0xFFFFFFFF) / 4294967295.0

    def noise2(x, y):
        ix, iy = math.floor(x), math.floor(y)
        fx, fy = x - ix, y - iy
        ux = fx * fx * (3.0 - 2.0 * fx)
        uy = fy * fy * (3.0 - 2.0 * fy)
        a = hash01(ix, iy)
        b = hash01(ix + 1, iy)
        c = hash01(ix, iy + 1)
        d = hash01(ix + 1, iy + 1)
        return (a * (1.0 - ux) + b * ux) * (1.0 - uy) + (
            c * (1.0 - ux) + d * ux
        ) * uy

    y_min, y_max = -40.0, -22.0
    row_count = 104
    toe = 2.15

    half_profile = [
        0.00, 0.20, 0.43, 0.70, 1.00, 1.27, 1.57,
        1.83, 2.07, 2.35, 2.67, 3.05, 3.55, 4.20,
    ]
    xs = [-toe, -1.45, -0.72, 0.0, 0.72, 1.45, toe]
    xs += [toe + v for v in half_profile]
    xs += [-(toe + v) for v in reversed(half_profile)]
    xs=sorted(set(xs))

    def crest_x(y):
        return (
            3.67
            + 0.17 * math.sin(0.49 * y + 0.6)
            + 0.09 * math.sin(1.31 * y)
            + 0.07 * (noise2(0.31 * y, 2.7) - 0.5)
        )

    def envelope(y):
        return smoothstep(-37.4, -33.4, y) * (
            1.0 - smoothstep(-25.7, -22.4, y)
        )

    def profile(x):
        r = abs(x) - toe
        if r <= 0.0:
            return 0.0
        rise = smoothstep(0.0, 1.35, r)
        shoulder = 1.0 - smoothstep(1.75, 4.20, r)
        return rise * shoulder

    def surface_point(x, y):
        env = envelope(y)
        wall = profile(x)
        side = 1.0 if x >= 0.0 else -1.0
        amplitude = 2.46 if x > 0.0 else 2.12

        floor_relief = (
            0.010 * (noise2(0.23 * x, 0.19 * y) - 0.5)
            + 0.006 * math.sin(1.55 * x + 0.47 * y)
        )

        warp = noise2(0.31 * x + 4.0, 0.24 * y - 2.0)
        phase = (
            side * 2.48 * x
            + 1.22 * y
            + 1.18 * warp
            + 0.38 * math.sin(0.83 * y + 0.31 * x)
        )
        rounded_ridge = math.sin(phase)
        narrow_furrow = (0.5 + 0.5 * math.cos(phase)) ** 7
        broad_fold = math.sin(
            0.77 * y + 1.14 * side * x + 1.7 * noise2(0.17 * x, 0.13 * y)
        )
        slow_undulation = noise2(0.22 * x + 9.0, 0.17 * y + 3.0) - 0.5

        z = floor_relief
        z += env * wall * (
            amplitude * (1.0 + 0.055 * slow_undulation)
            + 0.050 * rounded_ridge
            - 0.027 * narrow_furrow
            + 0.052 * broad_fold
            + 0.022 * (noise2(0.73 * x, 0.57 * y) - 0.5)
        )
        return (x, y, z + .06)

    rows = []
    for row in range(row_count):
        t = row / (row_count - 1)
        y = y_min + (y_max - y_min) * t
        rows.append([surface_point(x, y) for x in xs])

    g.surface("macro_dermatoglyph_valley", rows, "skin")

    bead_ys = [
        -38.70, -37.92, -36.83, -35.91, -34.77,
        -33.62, -32.54, -31.20, -29.96, -28.61,
        -27.18, -25.64,
    ]
    bead_lengths = [
        0.16, 0.12, 0.19, 0.14, 0.17, 0.11,
        0.18, 0.13, 0.20, 0.15, 0.12, 0.17,
    ]
    bead_radii = [
        0.031, 0.026, 0.035, 0.028, 0.032, 0.025,
        0.034, 0.029, 0.036, 0.027, 0.030, 0.033,
    ]

    for i, (yc, length, radius) in enumerate(
        zip(bead_ys, bead_lengths, bead_radii)
    ):
        xc = crest_x(yc)
        dx = (crest_x(yc + 0.05) - crest_x(yc - 0.05)) / 0.10
        points = []
        for u in (-0.5, 0.0, 0.5):
            yy = yc + u * length
            xx = xc + dx * u * length
            xx += 0.010 * math.sin(i * 1.73 + u * math.pi)
            zz = surface_point(xx, yy)[2] - radius * 0.30
            points.append((xx, yy, zz))
        g.tube("lipid_ridge_%02d" % i, points, radius, "skin")

    for i in (2, 6, 10):
        yc = bead_ys[i]
        xc = crest_x(yc)
        dx = (crest_x(yc + 0.03) - crest_x(yc - 0.03)) / 0.06
        half = 0.022
        points = []
        for u in (-half, half):
            yy = yc + u
            xx = xc + dx * u
            zz = surface_point(xx, yy)[2] + 0.023
            points.append((xx, yy, zz))
        g.tube("lipid_highlight_%02d" % i, points, 0.006, "silk")
