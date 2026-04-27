import csv
import sys
from pathlib import Path


def read_points(path):
    positions = []
    temperatures = []

    with open(path, newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        for row in reader:
            positions.append(float(row["position"]))
            temperatures.append(float(row["temperature"]))

    if not positions:
        raise ValueError("CSV does not contain any data rows")

    return positions, temperatures


def scale(value, source_min, source_max, target_min, target_max):
    if source_max == source_min:
        return (target_min + target_max) / 2.0
    ratio = (value - source_min) / (source_max - source_min)
    return target_min + ratio * (target_max - target_min)


def build_svg(positions, temperatures):
    width = 960
    height = 540
    margin_left = 70
    margin_right = 30
    margin_top = 30
    margin_bottom = 60
    plot_width = width - margin_left - margin_right
    plot_height = height - margin_top - margin_bottom

    min_x = min(positions)
    max_x = max(positions)
    min_y = min(0.0, min(temperatures))
    max_y = max(100.0, max(temperatures))

    points = []
    for position, temperature in zip(positions, temperatures):
        x = scale(position, min_x, max_x, margin_left, margin_left + plot_width)
        y = scale(temperature, min_y, max_y, margin_top + plot_height, margin_top)
        points.append(f"{x:.2f},{y:.2f}")

    x_axis_y = margin_top + plot_height
    y_axis_x = margin_left

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="{width / 2}" y="24" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700">1D Heat Distribution</text>
  <line x1="{y_axis_x}" y1="{margin_top}" x2="{y_axis_x}" y2="{x_axis_y}" stroke="#1f2937" stroke-width="2"/>
  <line x1="{margin_left}" y1="{x_axis_y}" x2="{margin_left + plot_width}" y2="{x_axis_y}" stroke="#1f2937" stroke-width="2"/>
  <polyline fill="none" stroke="#2563eb" stroke-width="2" points="{" ".join(points)}"/>
  <text x="{width / 2}" y="{height - 18}" text-anchor="middle" font-family="Arial" font-size="14">position</text>
  <text x="18" y="{height / 2}" text-anchor="middle" font-family="Arial" font-size="14" transform="rotate(-90 18 {height / 2})">temperature</text>
  <text x="{margin_left}" y="{x_axis_y + 24}" text-anchor="middle" font-family="Arial" font-size="12">{int(min_x)}</text>
  <text x="{margin_left + plot_width}" y="{x_axis_y + 24}" text-anchor="middle" font-family="Arial" font-size="12">{int(max_x)}</text>
  <text x="{margin_left - 10}" y="{x_axis_y}" text-anchor="end" font-family="Arial" font-size="12">{min_y:.0f}</text>
  <text x="{margin_left - 10}" y="{margin_top + 4}" text-anchor="end" font-family="Arial" font-size="12">{max_y:.0f}</text>
</svg>
"""


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("output.csv")
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("heat_distribution.svg")

    positions, temperatures = read_points(input_path)
    output_path.write_text(build_svg(positions, temperatures), encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
