import random
import math

def world1(g):
    random.seed(11)
    g.rock("island", (3, 2, .35), (1.0, 1.35, .45), "basalt")
    g.bowl("outer_bowl", (3, 2, .65), 1.0, .85, "clay")
    g.bowl("inner_bowl", (3, 2, .92), .78, .58, "chalk")
    g.rock("resting_stone", (3, 2, 1.42), (.34, .28, .42), "basalt", 7)
    for i in range(5):
        x = 3.1 + .65 * math.sin(i * 1.3)
        y = 2.0 + .5 * math.cos(i * 1.1)
        g.ell("niche_%d" % i, (x, y, 1.0 + .1 * (i % 3)), (.22, .18, .28), "clay")
    for i in range(7):
        x = -3.5 - .35 * i
        y = -2.0 + i * .55
        g.ell("ash_%d" % i, (x, y, 1.0), (.28, .22, 1.0 + .1 * (i % 2)), "chalk")
    rows = []
    for j in range(7):
        row = []
        for i in range(9):
            u = i / 8.0
            v = j / 6.0
            x = 3 + (u - .5) * 1.35
            y = 2 + .25 * math.sin(u * math.pi * 2)
            z = .72 + .18 * math.sin(v * math.pi) + .08 * math.cos(u * 7)
            row.append((x, y, z))
        rows.append(row)
    g.surface("curved_inner_film", rows, "film6")
    g.ring("moon", (-4.2, 5.8, 2.4), 1.25, .12, "gold")
    for i in range(4):
        g.tube("spare_arc_%d" % i, [(-5 + i*.22, -1, .1), (-5 + i*.22, 2, 2.8), (-3.5, 6, 3.6)], .035, "brass")

def world2(g):
    random.seed(23)
    for i in range(7):
        y = -2.0 + i * .72
        x = 4.0 + .25 * math.sin(i)
        g.tube("harp_column_%d" % i, [(x, y, .1), (x + .1, y, 2.8), (x - .1, y + .25, 4.4)], .11, "brass")
    for i in range(7):
        y = -2.0 + i * .72
        g.tube("harp_string_%d" % i, [(4 + .25 * math.sin(i), y, .3), (4.65 + .12 * math.sin(i), y, 4.1)], .018, "gold")
    for i in range(6):
        pts = []
        for j in range(18):
            a = j / 17 * math.pi * 2
            pts.append((3.7 + .65 * math.cos(a), -1.0 + i * .8 + .12 * math.sin(a * 3), 1.9 + .55 * math.sin(a)))
        g.tube("echo_wave_%d" % i, pts, .045, "gold")
    rows = []
    for j in range(9):
        row = []
        for i in range(10):
            u = i / 9
            v = j / 8
            x = -3.8 + u * 1.7
            y = -2.5 + v * 4.8
            z = .25 + .65 * math.sin(u * math.pi * 5) * (1 - v * .45)
            row.append((x, y, z))
        rows.append(row)
    g.surface("pleated_silk", rows, "film3")
    for i in range(6):
        g.ell("echo_stone_%d" % i, (-4.5 + (i % 2)*.6, 3 + i*.65, .55), (.38, .3, .55), "basalt")
    g.ell("bronze_seed", (4.7, 3.6, 1.2), (.45, .35, 1.1), "brass")
    g.ring("sound_halo", (4.8, 4.5, 3.1), 1.0, .08, "gold")

def world3(g):
    random.seed(37)
    for i in range(12):
        x = random.choice([-1, 1]) * random.uniform(3.0, 6.5)
        y = random.uniform(-5.5, 6.0)
        h = random.uniform(1.5, 3.8)
        g.ell("charcoal_tree_%d" % i, (x, y, h/2), (.38, .45, h/2), "ash")
        g.tube("branch_%d" % i, [(x, y, h*.7), (x + random.uniform(-.8,.8), y+.2, h*.95), (x + random.uniform(-1.1,1.1), y+.3, h+random.uniform(.2,.8))], .11, "basalt")
    for i in range(10):
        x = random.choice([-1, 1]) * random.uniform(3.3, 6.0)
        y = random.uniform(-5, 6)
        g.ell("ember_%d" % i, (x, y, random.uniform(.2, 3.2)), (.09, .09, .09), "gold")
    for i in range(5):
        y = -4 + i * 2.1
        pts = [(-6 + j*.5, y + .15*math.sin(j), .047 + .018*math.sin(j)) for j in range(25)]
        g.tube("glowing_seam_%d" % i, pts, .035, "gold")
    rows = []
    for j in range(9):
        row = []
        for i in range(12):
            u = i / 11
            v = j / 8
            x = -4.8 + u * 2.1
            y = -4.8 + v * 9.0
            z = .2 + .6 * math.sin(u * 3.2) + .25 * math.cos(v * 5)
            row.append((x, y, z))
        rows.append(row)
    g.surface("ash_cliff_film", rows, "film5")
    for i in range(5):
        g.ell("cliff_stone_%d" % i, (-5.0 + .18*i, 4.0 + .5*i, .7 + .15*i), (.55, .45, .8), "ash")
    g.ell("ember_core", (5.8, 1.0, 1.0), (.22, .22, .22), "gold")