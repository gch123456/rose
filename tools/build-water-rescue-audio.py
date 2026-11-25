"""Rebuild the original, mono Water Rescue sound effects."""
import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 24000
DESTINATION = Path(__file__).resolve().parents[1] / 'assets/resources/color-clear-audio'
TAU = math.tau


def sound(t, white, low, fast, name):
    hiss = fast - low
    if name == 'valve':
        return (
            .48 * math.sin(TAU * (680 * t - 720 * t * t)) * math.exp(-35 * t)
            + .35 * white * math.exp(-84 * t)
            + .27 * hiss * math.exp(-32 * abs(t - .07))
        )
    if name == 'hit':
        return (
            .65 * hiss * math.exp(-11 * t)
            + .36 * low * math.exp(-7 * t)
            + .19 * math.sin(TAU * (114 * t - 59 * t * t)) * math.exp(-12 * t)
            + .16 * hiss * math.exp(-49 * abs(t - .14))
        )
    if name in ('merge', 'drain'):
        heavy = name == 'drain'
        attack = min(1, t * (7 if heavy else 16))
        surface = (.70 * hiss + 1.10 * low) * attack * math.exp((-3.1 if heavy else -5.2) * t)
        body = .28 * math.sin(TAU * (104 * t - 21 * t * t)) * attack * math.exp(-7 * t)
        splash_t = t - (.18 if heavy else .105)
        spray = .74 * hiss * math.exp(-13 * splash_t) * min(1, splash_t * 40) if splash_t > 0 else 0
        return surface + body + spray
    pulse_number = int(t > .20)
    local = t - .20 * pulse_number
    phase = TAU * (330 * local - 680 * local * local) + math.sin(TAU * 34 * local) * 1.5
    envelope = min(1, local * 70) * math.exp(-15 * local)
    return (.29 * math.sin(phase) + .20 * math.sin(2 * phase) + .19 * hiss) * envelope * (.8 ** pulse_number)


def write_clip(name, duration):
    rng = random.Random(42)
    low = fast = 0.0
    samples = []
    for index in range(round(duration * SAMPLE_RATE)):
        t = index / SAMPLE_RATE
        white = rng.uniform(-1, 1)
        low += (white - low) * .018
        fast += (white - fast) * .25
        fade = max(0, min(1, t * 800, (duration - t) * 30))
        samples.append(math.tanh(sound(t, white, low, fast, name)) * fade)
    # Leave headroom when multiple valves arrive on the same frame.
    peak = max(abs(value) for value in samples)
    pcm = struct.pack('<' + 'h' * len(samples), *(round(value * 20000 / peak) for value in samples))
    with wave.open(str(DESTINATION / f'water-{name}.wav'), 'wb') as output:
        output.setparams((1, 2, SAMPLE_RATE, 0, 'NONE', 'not compressed'))
        output.writeframes(pcm)


if __name__ == '__main__':
    for clip, duration in {'valve': .22, 'hit': .39, 'merge': .74, 'drain': 1.1, 'duck': .47}.items():
        write_clip(clip, duration)
