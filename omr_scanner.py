#!/usr/bin/env python3
"""
Optical Mark Recognition (OMR) Engine (OpenCV / Pure Image Processing Pipeline)
Calibrated on official 60-item answer sheets (3x20 grid, 12-digit LRN, 4 fiducials).
Extracts 12-digit Student LRN and 60 Answer Choices (A, B, C, D) using deterministic
Two-Zone Circular Relative Normalization, fiducial perspective alignment, and question-level ranking.
"""

import sys
import json
import base64
import time
import math
import io

# Calibrated 60-item OMR coordinate reference (1467 x 2048 px)
REF_WIDTH = 1467
REF_HEIGHT = 2048

# Corner fiducial reference centers
TARGET_TL = (110, 252)
TARGET_TR = (1355, 252)
TARGET_BL = (110, 1928)
TARGET_BR = (1355, 1928)

# LRN Grid coordinates (12 columns x 10 rows: 0..9)
LRN_COLS_X = [322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760]
LRN_ROWS_Y = [428, 473, 518, 563, 608, 653, 697, 738, 783, 828]

# 60 Question Grid coordinates (3 columns of 20 items)
QUESTION_COLUMNS = [
    {"startQ": 1, "endQ": 20, "A": 392, "B": 436, "C": 480, "D": 524},
    {"startQ": 21, "endQ": 40, "A": 673, "B": 717, "C": 761, "D": 807},
    {"startQ": 41, "endQ": 60, "A": 951, "B": 997, "C": 1041, "D": 1087},
]
QUESTION_ROWS_Y = [
    947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386,
    1464, 1514, 1563, 1611, 1659, 1708, 1757, 1806, 1854, 1903,
]

class OMRConfig:
    def __init__(self):
        self.bubble_radius = 11.0
        self.lrn_bubble_radius = 9.5
        self.inner_radius_ratio = 0.55
        self.ring_inner_ratio = 0.72

        self.contrast_weight = 0.45
        self.dark_ratio_weight = 0.35
        self.percentile_weight = 0.20

        self.adaptive_offset_min = 18.0
        self.adaptive_offset_ratio = 0.12

        self.min_score = 0.20
        self.min_margin = 0.10
        self.multiple_score = 0.20

def analyze_bubble(gray_img, width, height, cx, cy, radius, config=None):
    if config is None:
        config = OMRConfig()

    inner_radius = radius * config.inner_radius_ratio
    ring_inner_radius = radius * config.ring_inner_ratio
    ring_outer_radius = radius

    inner_radius_sq = inner_radius * inner_radius
    ring_inner_radius_sq = ring_inner_radius * ring_inner_radius
    ring_outer_radius_sq = ring_outer_radius * ring_outer_radius

    inner_pixels = []
    ring_sum = 0.0
    ring_count = 0
    inner_sum = 0.0

    r_int = int(math.ceil(radius))
    for dy in range(-r_int, r_int + 1):
        py = cy + dy
        if py < 0 or py >= height:
            continue
        dy_sq = dy * dy
        for dx in range(-r_int, r_int + 1):
            px = cx + dx
            if px < 0 or px >= width:
                continue
            dist_sq = dx * dx + dy_sq
            val = gray_img[py * width + px]

            if dist_sq <= inner_radius_sq:
                inner_sum += val
                inner_pixels.append(val)

            if ring_inner_radius_sq <= dist_sq <= ring_outer_radius_sq:
                ring_sum += val
                ring_count += 1

    inner_count = len(inner_pixels)
    inner_mean = inner_sum / inner_count if inner_count > 0 else 255.0
    ring_mean = ring_sum / ring_count if ring_count > 0 else 255.0

    p20 = 255.0
    if inner_count > 0:
        inner_pixels.sort()
        p20_idx = int(0.20 * (inner_count - 1))
        p20 = float(inner_pixels[p20_idx])

    safe_ring_mean = max(1.0, ring_mean)
    contrast = max(0.0, (ring_mean - inner_mean) / safe_ring_mean)
    percentile_darkness = max(0.0, (ring_mean - p20) / safe_ring_mean)

    adaptive_thresh = ring_mean - max(config.adaptive_offset_min, ring_mean * config.adaptive_offset_ratio)
    dark_count = sum(1 for v in inner_pixels if v < adaptive_thresh)
    dark_ratio = dark_count / inner_count if inner_count > 0 else 0.0

    score = (
        config.contrast_weight * contrast +
        config.dark_ratio_weight * dark_ratio +
        config.percentile_weight * percentile_darkness
    )

    return {
        "cx": cx,
        "cy": cy,
        "inner_mean": inner_mean,
        "ring_mean": ring_mean,
        "p20": p20,
        "contrast": contrast,
        "dark_ratio": dark_ratio,
        "percentile_darkness": percentile_darkness,
        "score": score,
        "filled": score >= config.min_score,
    }

def classify_question(measurements, q_num, config=None):
    if config is None:
        config = OMRConfig()

    sorted_m = sorted(measurements, key=lambda x: x["metric"]["score"], reverse=True)
    first = sorted_m[0]
    second = sorted_m[1]

    best_score = first["metric"]["score"]
    second_score = second["metric"]["score"]
    margin = best_score - second_score

    if best_score < config.min_score:
        return {"q": q_num, "answer": None, "conf": min(0.99, max(0.85, 1.0 - best_score)), "blank": True}
    elif second_score >= config.multiple_score and margin < config.min_margin:
        return {"q": q_num, "answer": "MULTIPLE", "conf": max(0.5, min(0.9, 0.6 + (second_score - config.multiple_score))), "multiple": True}
    elif margin < config.min_margin:
        return {"q": q_num, "answer": "MULTIPLE", "conf": max(0.45, min(0.75, 0.5 + margin)), "ambiguous": True}
    else:
        norm_margin = min(1.0, margin / 0.5)
        norm_score = min(1.0, best_score / 0.8)
        conf = min(0.99, max(0.70, 0.50 + 0.30 * norm_margin + 0.20 * norm_score))
        return {"q": q_num, "answer": first["option"], "conf": conf, "winner": first["option"]}
