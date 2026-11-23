import math
import random

def world4(g):
    rng = random.Random(41)
    g.ell("water_opening", (0, 1.4, 0.035), (3.1, 3.8, 0.035), "water")
    for i in range(6):
        x = -3.8 + i * 1.52
        z = 4.5 + 0.38 * math.sin(i * 0.9)
        rows = []
        for r in range(7):
            row = []
            for c in range(9):
                u = c / 8
                v = r / 6
                y = -0.8 + i * 0.72 + 1.25 * math.sin(u * math.pi * 0.9)
                row.append((x + (u - 0.5) * 1.05,
                            y + 0.24 * math.sin(v * math.pi),
                            z + 0.5 * v + 0.16 * math.sin(u * math.pi * 2)))
            rows.append(row)
        mat = "film0" if i == 2 else "chalk"
        g.surface("breathing_sail_%02d" % i, rows, mat)
        spar = []
        for k in range(13):
            u = k / 12
            spar.append((x + (u - 0.5) * 1.12,
                         -0.82 + i * 0.72 + 1.25 * math.sin(u * math.pi * 0.9),
                         z - 0.04 + 0.13 * math.sin(u * math.pi * 2)))
        g.tube("fluted_spar_%02d" % i, spar, 0.035, "basalt")
    for i in range(20):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(6.4, 8.5)
        g.rock("shore_stone_%02d" % i,
               (math.cos(a) * r, math.sin(a) * r, 0.18),
               (rng.uniform(0.35, 0.9), rng.uniform(0.3, 0.8), rng.uniform(0.2, 0.65)),
               "basalt", seed=50 + i)

def world5(g):
    rng = random.Random(52)
    for side in (-1, 1):
        x = side * 4.4
        g.box("ebonized_table_%d" % side, (x, 1.3, 0.72), (3.2, 1.55, 0.16), "ink")
        for dx in (-1.25, 1.25):
            for dy in (-0.55, 0.55):
                g.ell("table_leg", (x + dx, 1.3 + dy, 0.35), (0.08, 0.08, 0.36), "ink")
        for j in range(3):
            y = 0.45 + j * 0.85
            g.bowl("pigment_bowl_%d_%d" % (side, j), (x - 0.65 + j * 0.65, y, 0.9),
                   0.32 + j * 0.05, 0.22 + 0.04 * j,
                   ("clay", "rose", "ink")[j])
    rows = []
    for r in range(19):
        row = []
        t = r / 18
        for c in range(9):
            u = c / 8
            x = -5.7 + 11.4 * u
            y = 2.3 + 1.35 * math.sin(u * math.tau * 1.4 + t * 1.1)
            z = 0.95 + 3.65 * t + 0.5 * math.sin(u * math.tau * 2.2)
            row.append((x, y, z))
        rows.append(row)
    g.surface("ochre_folded_ribbon", rows, "clay")
    strip = []
    for c in range(7):
        u = c / 6
        strip.append((-4.4 + 8.8 * u,
                      0.55 + 0.42 * math.sin(u * math.tau),
                      1.1 + 0.5 * math.sin(u * math.tau * 1.5)))
    g.tube("ochre_trace", strip, 0.055, "gold")
    rows = []
    for r in range(13):
        row = []
        t = r / 12
        for c in range(7):
            u = c / 6
            row.append((-3.8 + .52 * math.sin(u * math.pi * 2),
                        -3.3 + 6.6 * u,
                        0.55 + 2.55 * t + 0.16 * math.sin(u * math.tau)))
        rows.append(row)
    g.surface("film_trace", rows, "film4")
    for i in range(16):
        x = rng.uniform(-7.8, 7.8)
        y = rng.uniform(-6.8, 7.8)
        if abs(x) < 2.2:
            x += 5.0 if x >= 0 else -5.0
        g.rock("studio_stone_%02d" % i, (x, y, 0.18),
               (rng.uniform(0.18, 0.48), rng.uniform(0.16, 0.42), rng.uniform(0.12, 0.32)),
               "basalt", seed=70 + i)

def world6(g):
    rng = random.Random(63)
    rows = []
    for r in range(25):
        row = []
        t = r / 24
        for c in range(9):
            u = c / 8
            x = -6.4 + 12.8 * u
            y = -2.8 + 5.6 * t + 1.35 * math.sin(u * math.tau * 1.7)
            z = 4.45 + 0.55 * math.sin(u * math.tau * 2.0 + t * 2.4)
            row.append((x, y, z))
        rows.append(row)
    g.surface("suspended_serpentine_stream", rows, "film2")
    for side in (-1, 1):
        curtain = []
        for k in range(13):
            t = k / 12
            curtain.append((side * (3.4 + 0.22 * math.sin(t * math.tau)),
                            0.4 + 0.42 * math.sin(t * math.tau),
                            4.15 - 3.05 * t))
        g.tube("liquid_curtain_%d" % side, curtain, 0.085, "water")
    rocks = [(-2.4, -1.1), (2.25, -0.15), (3.2, 1.1), (-2.1, 1.65)]
    for i, (x, y) in enumerate(rocks):
        g.rock("isolated_real_rock_%02d" % i, (x, y, 0.32),
               (0.7, 0.62, 0.5), "basalt", seed=90 + i)
    for i in range(14):
        x = rng.uniform(-1.8, 1.8)
        y = rng.uniform(-1.6, 2.0)
        z = rng.uniform(1.1, 3.6)
        g.ell("suspended_drop_%02d" % i, (x, y, z),
              (rng.uniform(0.07, 0.16), rng.uniform(0.07, 0.16), rng.uniform(0.15, 0.34)),
              "water")
    for i in range(18):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(6.5, 8.4)
        g.rock("current_stone_%02d" % i,
               (math.cos(a) * r, math.sin(a) * r, 0.2),
               (rng.uniform(0.3, 0.8), rng.uniform(0.25, 0.7), rng.uniform(0.2, 0.6)),
               "basalt", seed=110 + i)

def world7(g):
    rng = random.Random(74)
    for i in range(19):
        u = i / 18
        x = -6.6 + 13.2 * u
        points = []
        for k in range(17):
            t = k / 16
            points.append((x + 0.22 * math.sin(t * math.tau + i),
                           -3.8 + 7.6 * t,
                           4.15 + 1.15 * math.sin(u * math.pi) + 0.25 * math.sin(t * math.tau)))
        g.tube("gold_warp_%02d" % i, points, 0.026 + 0.012 * (i % 3), "gold")
    for j in range(15):
        v = j / 14
        points = []
        for k in range(21):
            u = k / 20
            points.append((-6.6 + 13.2 * u,
                           -3.8 + 7.6 * v,
                           4.15 + 1.15 * math.sin(u * math.pi) + 0.25 * math.sin(u * math.tau + j)))
        g.tube("luminous_weft_%02d" % j, points, 0.024 + 0.01 * (j % 2), "gold")
    for i in range(8):
        rows = []
        for r in range(9):
            row = []
            t = r / 8
            for c in range(5):
                u = c / 4
                x = -4.8 + i * 1.35 + (u - 0.5) * 0.9
                y = -1.1 + 0.3 * math.sin(i)
                z = 3.80 - (1.10 if abs(x)<2.1 else 1.9) * t + 0.18 * math.sin(u * math.pi)
                row.append((x, y, z))
            rows.append(row)
        g.surface("diaphanous_film_%02d" % i, rows, "film7" if i % 2 == 0 else "silk")
    for i in range(14):
        x = rng.choice((-1, 1)) * rng.uniform(4.5, 7.8)
        y = rng.uniform(-5.5, 6.5)
        g.ell("silk_seed_%02d" % i, (x, y, 0.17),
              (rng.uniform(0.12, 0.34), rng.uniform(0.12, 0.4), rng.uniform(0.08, 0.22)),
              "silk")