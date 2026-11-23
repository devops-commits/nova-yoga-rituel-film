"""Bake the lathed bronze finish. Run with Python, NumPy and Pillow."""
from pathlib import Path
import numpy as np
from PIL import Image


def bake(directory):
    width, height = 1024, 512
    y, x = np.mgrid[:height, :width]
    u, v = x / width, 1 - y / height
    rng = np.random.default_rng(611)
    # Stagger the overlapping, shallow hammer impressions around the bowl.
    # Calculate the wrapped distance so the azimuthal seam is invisible.
    indent = np.zeros_like(u)
    for row in range(19):
        for col in range(33):
            du = (u - (col + .5 * (row % 2) + rng.uniform(-.30, .30)) / 33 + .5) % 1 - .5
            dv = v - (row + rng.uniform(-.30, .30)) / 18
            radius = (du / rng.uniform(.014, .025)) ** 2 + (dv / rng.uniform(.028, .049)) ** 2
            indent = np.maximum(indent, rng.uniform(.64, 1) * np.maximum(1 - radius, 0) ** 2)
    angle = u * 2 * np.pi
    waviness = .55 * np.sin(3 * angle + v * 7) + .23 * np.cos(7 * angle - v * 9)
    rings = np.sin(2 * np.pi * v * 97 + waviness)
    tool = -indent + .032 * rings
    du = (np.roll(tool, -1, axis=1) - np.roll(tool, 1, axis=1)) * 2.2
    dv = np.gradient(tool, axis=0) * 3.6
    # The radius collapses at the base of the cavity, where circular tool marks
    # supplant the facets. Fade azimuthal variation before it pinches at the pole.
    wall = np.clip(np.minimum(v, 1-v) / .12, 0, 1)
    wall *= wall * (3 - 2 * wall)
    du *= wall
    dv *= .22 + .78 * wall
    normal = np.dstack((-du, dv, np.ones_like(tool)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    patina = np.clip(.37 + .32 * np.sin(5 * angle + v * 16 + waviness)
                     * np.cos(3 * angle - v * 22) + .25 * indent, 0, 1)
    patina = .45 + wall * (patina - .45)
    indent *= wall
    value = .98 - .30 * patina - .11 * indent + .03 * rings
    rough = .30 + .25 * patina + .07 * indent + .028 * rings
    for filename, rgb in [
        ('bronze-color.jpg', np.dstack((value, value - .045 * patina, value - .11 * patina))),
        ('bronze-normal.png', normal * .5 + .5),
        ('bronze-orm.png', np.dstack((np.ones_like(u), rough, .93 - .19 * patina))),
    ]:
        Image.fromarray((np.clip(rgb, 0, 1) * 255 + .5).astype('uint8')).save(directory / filename, quality=95)


if __name__ == '__main__':
    bake(Path(__file__).resolve().parent / 'surfaces')
