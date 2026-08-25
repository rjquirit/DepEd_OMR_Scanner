#!/usr/bin/env python3
"""
Optical Mark Recognition (OMR) Engine (OpenCV / Pure Python Reference Pipeline) - Version 5.0
Calibrated on DepEd Region X 60-item answer sheets (1467 x 2048 canonical space).
Extracts 12-digit Student LRN and 60 Answer Choices (A, B, C, D) using Two-Zone Multi-Feature
Circular Measurement, Constrained Center Refinement, and Question-Level Margin Classification.
"""

import sys
import json
import math

REF_WIDTH = 1467
REF_HEIGHT = 2048

TARGET_TL = (110.0, 252.0)
TARGET_TR = (1355.0, 252.0)
TARGET_BR = (1355.0, 1928.0)
TARGET_BL = (110.0, 1928.0)

LRN_COLS_X = [322, 362, 403, 443, 483, 522, 562, 601, 641, 681, 723, 760]
LRN_ROWS_Y = [428, 473, 518, 563, 608, 653, 697, 742, 788, 834]

QUESTION_BLOCKS = [
    # Top Section (Rows 0-9)
    {"blockId": "LEFT_TOP", "column": 1, "section": "TOP", "startQ": 1, "endQ": 10, "startRowIdx": 0, "A": 392, "B": 436, "C": 480, "D": 524},
    {"blockId": "CENTER_TOP", "column": 2, "section": "TOP", "startQ": 11, "endQ": 20, "startRowIdx": 0, "A": 673, "B": 717, "C": 761, "D": 807},
    {"blockId": "RIGHT_TOP", "column": 3, "section": "TOP", "startQ": 21, "endQ": 30, "startRowIdx": 0, "A": 951, "B": 997, "C": 1041, "D": 1087},
    # Bottom Section (Rows 10-19)
    {"blockId": "LEFT_BOTTOM", "column": 1, "section": "BOTTOM", "startQ": 31, "endQ": 40, "startRowIdx": 10, "A": 392, "B": 436, "C": 480, "D": 524},
    {"blockId": "CENTER_BOTTOM", "column": 2, "section": "BOTTOM", "startQ": 41, "endQ": 50, "startRowIdx": 10, "A": 673, "B": 717, "C": 761, "D": 807},
    {"blockId": "RIGHT_BOTTOM", "column": 3, "section": "BOTTOM", "startQ": 51, "endQ": 60, "startRowIdx": 10, "A": 951, "B": 997, "C": 1041, "D": 1087},
]

QUESTION_ROWS_Y = [
    # TOP Section (Rows 0 to 9: Q01-Q30)
    947, 997, 1046, 1096, 1144, 1193, 1240, 1287, 1338, 1386,
    # BOTTOM Section (Rows 10 to 19: Q31-Q60)
    1478, 1528, 1577, 1625, 1673, 1722, 1771, 1820, 1868, 1918,
]

def get_question_coordinate_def(q_num):
    for block in QUESTION_BLOCKS:
        if block["startQ"] <= q_num <= block["endQ"]:
            r_offset = q_num - block["startQ"]
            row_idx = block["startRowIdx"] + r_offset
            return {
                "question": q_num,
                "y": QUESTION_ROWS_Y[row_idx],
                "A": block["A"],
                "B": block["B"],
                "C": block["C"],
                "D": block["D"],
            }
    raise ValueError(f"Invalid question number: {q_num}")

class OMRConfig:
    def __init__(self):
        self.config_version = "5.0.0"
        self.physical_bubble_radius = 15.0
        self.physical_lrn_bubble_radius = 13.5

        self.question_core_radius = 7.5
        self.question_ring_inner_radius = 12.0
        self.question_ring_outer_radius = 15.0
        self.question_paper_ring_inner_radius = 18.0
        self.question_paper_ring_outer_radius = 22.0

        self.lrn_core_radius = 6.0
        self.lrn_ring_inner_radius = 10.0
        self.lrn_ring_outer_radius = 13.0

        self.center_search_radius_px = 12
        self.max_center_offset_px = 14.0

        self.adaptive_offset_min = 18.0
        self.adaptive_offset_ratio = 0.12

        self.contrast_weight = 0.35
        self.dark_ratio_weight = 0.30
        self.percentile_weight = 0.20
        self.component_weight = 0.10
        self.centroid_weight = 0.05

        self.min_fill_score = 0.20
        self.min_classification_margin = 0.10
        self.multiple_score = 0.20

def refine_center(gray_img, width, height, exp_x, exp_y, core_r, search_r, max_offset):
    best_x = exp_x
    best_y = exp_y
    best_dark_score = -1e9
    small_r = max(3, int(core_r * 0.7))
    small_r_sq = small_r * small_r

    for sdy in range(-search_r, search_r + 1):
        cy = exp_y + sdy
        if cy < core_r or cy >= height - core_r:
            continue
        for sdx in range(-search_r, search_r + 1):
            dist = math.sqrt(sdx * sdx + sdy * sdy)
            if dist > max_offset:
                continue
            cx = exp_x + sdx
            if cx < core_r or cx >= width - core_r:
                continue

            sum_val = 0
            count = 0
            for dy in range(-small_r, small_r + 1):
                py = cy + dy
                dy_sq = dy * dy
                row_offset = py * width
                for dx in range(-small_r, small_r + 1):
                    if dx * dx + dy_sq <= small_r_sq:
                        sum_val += 255 - gray_img[row_offset + cx + dx]
                        count += 1

            score = (sum_val / count) if count > 0 else 0.0
            penalized = score - dist * 1.5
            if penalized > best_dark_score:
                best_dark_score = score
                best_x = cx
                best_y = cy

    if best_dark_score > 35.0:
        return best_x, best_y, float(best_x - exp_x), float(best_y - exp_y)
    return exp_x, exp_y, 0.0, 0.0

def analyze_bubble(gray_img, width, height, exp_x, exp_y, core_r, ring_in_r, ring_out_r, config=None, paper_in_r=0, paper_out_r=0):
    if config is None:
        config = OMRConfig()

    act_x, act_y, off_x, off_y = refine_center(gray_img, width, height, exp_x, exp_y, core_r, config.center_search_radius_px, config.max_center_offset_px)

    core_r_sq = core_r * core_r
    ring_in_sq = ring_in_r * ring_in_r
    ring_out_sq = ring_out_r * ring_out_r
    paper_in_sq = paper_in_r * paper_in_r
    paper_out_sq = paper_out_r * paper_out_r

    inner_sum = 0.0
    inner_pixels = []
    inner_coords = []

    ring_sum = 0.0
    ring_count = 0
    paper_sum = 0.0
    paper_count = 0

    max_r = int(math.ceil(max(ring_out_r, paper_out_r if paper_out_r > 0 else ring_out_r)))

    for dy in range(-max_r, max_r + 1):
        py = act_y + dy
        if py < 0 or py >= height:
            continue
        dy_sq = dy * dy
        row_offset = py * width

        for dx in range(-max_r, max_r + 1):
            px = act_x + dx
            if px < 0 or px >= width:
                continue
            dist_sq = dx * dx + dy_sq
            val = gray_img[row_offset + px]

            if dist_sq <= core_r_sq:
                inner_sum += val
                inner_pixels.append(val)
                inner_coords.append((dx, dy, val))

            if ring_in_sq <= dist_sq <= ring_out_sq:
                ring_sum += val
                ring_count += 1

            if paper_out_r > 0 and paper_in_sq <= dist_sq <= paper_out_sq:
                paper_sum += val
                paper_count += 1

    inner_count = len(inner_pixels)
    core_mean = inner_sum / inner_count if inner_count > 0 else 255.0
    ref_paper_mean = (paper_sum / paper_count) if paper_count > 0 else ((ring_sum / ring_count) if ring_count > 0 else 255.0)
    ring_mean = (ring_sum / ring_count) if ring_count > 0 else ref_paper_mean
    if ref_paper_mean < ring_mean * 0.9:
        ref_paper_mean = ring_mean

    p10, p20, p30 = 255.0, 255.0, 255.0
    if inner_count > 0:
        inner_pixels.sort()
        p10 = float(inner_pixels[int(0.10 * (inner_count - 1))])
        p20 = float(inner_pixels[int(0.20 * (inner_count - 1))])
        p30 = float(inner_pixels[int(0.30 * (inner_count - 1))])

    safe_paper = max(1.0, ref_paper_mean)
    contrast = max(0.0, min(1.0, (ref_paper_mean - core_mean) / safe_paper))
    percentile_darkness = max(0.0, min(1.0, (ref_paper_mean - p20) / safe_paper))

    adaptive_thresh = ref_paper_mean - max(config.adaptive_offset_min, ref_paper_mean * config.adaptive_offset_ratio)
    dark_count = 0
    sum_dark_dx, sum_dark_dy, sum_dark_w = 0.0, 0.0, 0.0

    r_int = int(math.ceil(core_r))
    grid_dim = r_int * 2 + 1
    dark_grid = [[False] * grid_dim for _ in range(grid_dim)]

    for dx, dy, val in inner_coords:
        if val < adaptive_thresh:
            dark_count += 1
            w = adaptive_thresh - val
            sum_dark_dx += dx * w
            sum_dark_dy += dy * w
            sum_dark_w += w
            gx = dx + r_int
            gy = dy + r_int
            if 0 <= gx < grid_dim and 0 <= gy < grid_dim:
                dark_grid[gy][gx] = True

    dark_ratio = dark_count / inner_count if inner_count > 0 else 0.0

    # Connected component
    visited = [[False] * grid_dim for _ in range(grid_dim)]
    comp_count = 0
    largest_comp = 0

    for gy in range(grid_dim):
        for gx in range(grid_dim):
            if dark_grid[gy][gx] and not visited[gy][gx]:
                comp_count += 1
                size = 0
                q = [(gx, gy)]
                visited[gy][gx] = True
                while q:
                    curr_x, curr_y = q.pop()
                    size += 1
                    for ndy in (-1, 0, 1):
                        for ndx in (-1, 0, 1):
                            if ndx == 0 and ndy == 0:
                                continue
                            nx, ny = curr_x + ndx, curr_y + ndy
                            if 0 <= nx < grid_dim and 0 <= ny < grid_dim and dark_grid[ny][nx] and not visited[ny][nx]:
                                visited[ny][nx] = True
                                q.append((nx, ny))
                if size > largest_comp:
                    largest_comp = size

    largest_comp_ratio = largest_comp / inner_count if inner_count > 0 else 0.0
    comp_score = largest_comp_ratio if comp_count == 1 else (largest_comp_ratio * 0.85)

    if sum_dark_w > 0:
        cdx = sum_dark_dx / sum_dark_w
        cdy = sum_dark_dy / sum_dark_w
        centroid_offset = math.sqrt(cdx * cdx + cdy * cdy)
        centroid_score = max(0.1, 1.0 - (centroid_offset / (core_r if core_r > 0 else 1.0)))
    else:
        centroid_offset = 0.0
        centroid_score = 0.5

    template_diff = max(0.0, min(1.0, (ref_paper_mean - p10) / safe_paper))

    score = (
        config.contrast_weight * contrast +
        config.dark_ratio_weight * dark_ratio +
        config.percentile_weight * percentile_darkness +
        config.component_weight * comp_score +
        config.centroid_weight * centroid_score
    )
    clamped_score = max(0.0, min(1.0, score))

    return {
        "expectedX": exp_x,
        "expectedY": exp_y,
        "actualX": act_x,
        "actualY": act_y,
        "offsetX": off_x,
        "offsetY": off_y,
        "coreMean": core_mean,
        "ringMean": ring_mean,
        "p10": p10,
        "p20": p20,
        "p30": p30,
        "contrast": contrast,
        "darkRatio": dark_ratio,
        "percentileDarkness": percentile_darkness,
        "filledAreaRatio": dark_ratio,
        "largestComponentRatio": largest_comp_ratio,
        "componentCount": comp_count,
        "centroidOffset": centroid_offset,
        "centroidScore": centroid_score,
        "templateDifference": template_diff,
        "score": clamped_score,
        "filled": clamped_score >= config.min_fill_score,
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

    if best_score < config.min_fill_score:
        return {"question": q_num, "answer": None, "confidence": min(0.99, max(0.85, 1.0 - best_score)), "blank": True, "multiple": False, "ambiguous": False}
    elif second_score >= config.multiple_score and margin < config.min_classification_margin:
        return {"question": q_num, "answer": "MULTIPLE", "confidence": max(0.5, min(0.92, 0.60 + (second_score - config.multiple_score))), "blank": False, "multiple": True, "ambiguous": True}
    elif margin < config.min_classification_margin:
        return {"question": q_num, "answer": "MULTIPLE", "confidence": max(0.40, min(0.75, 0.50 + margin)), "blank": False, "multiple": False, "ambiguous": True}
    else:
        norm_margin = min(1.0, margin / 0.40)
        norm_score = min(1.0, best_score / 0.75)
        centroid_factor = first["metric"]["centroidScore"]
        conf = min(0.99, max(0.70, 0.50 + 0.49 * (0.45 * norm_margin + 0.35 * norm_score + 0.20 * centroid_factor)))
        return {"question": q_num, "answer": first["option"], "confidence": conf, "blank": False, "multiple": False, "ambiguous": False}
