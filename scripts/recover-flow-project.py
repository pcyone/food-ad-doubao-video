#!/opt/gflow-venv/bin/python
"""Recover a generated Flow video from an existing project without resubmitting."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from gflow_cli.api.client import FlowApiClient


UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
PROFILE_DIR = Path("/data/gflow/profile_flow")


def walk(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def collect_candidates(value: Any, project_id: str) -> tuple[set[str], dict[str, str]]:
    candidates: set[str] = set()
    statuses: dict[str, str] = {}
    for item in walk(value):
        name = item.get("name")
        if isinstance(name, str) and UUID_RE.fullmatch(name) and name != project_id:
            if (
                item.get("projectId") == project_id
                or "mediaMetadata" in item
                or "video" in item
                or "mediaStatus" in item
            ):
                candidates.add(name)
        meta = item.get("mediaMetadata")
        if isinstance(name, str) and isinstance(meta, dict):
            media_status = meta.get("mediaStatus")
            if isinstance(media_status, dict):
                status = media_status.get("mediaGenerationStatus")
                if isinstance(status, str):
                    candidates.add(name)
                    statuses[name] = status
    return candidates, statuses


async def recover(project_id: str, destination_dir: Path, wait_seconds: int) -> int:
    destination_dir.mkdir(parents=True, exist_ok=True)
    candidates: set[str] = set()
    statuses: dict[str, str] = {}
    observed_routes: set[str] = set()

    async with FlowApiClient(profile_dir=PROFILE_DIR, out_dir=destination_dir) as client:
        page = client._page
        if page is None:
            raise RuntimeError("Flow browser page was not initialized")

        async def on_response(response: Any) -> None:
            route = urlparse(response.url).path
            if not any(
                marker in route
                for marker in (
                    "/video:", "/flow/", "/media/", "flowWorkflows", "getFlow", "getProject"
                )
            ):
                return
            observed_routes.add(route)
            try:
                body = await response.json()
            except Exception:
                return
            found, found_statuses = collect_candidates(body, project_id)
            candidates.update(found)
            statuses.update(found_statuses)

        page.on("response", on_response)
        try:
            await page.goto(
                f"https://labs.google/fx/en/tools/flow/project/{project_id}",
                wait_until="domcontentloaded",
                timeout=90_000,
            )
            elapsed = 0
            while elapsed < wait_seconds:
                await asyncio.sleep(min(10, wait_seconds - elapsed))
                elapsed += min(10, wait_seconds - elapsed)
                html = await page.content()
                for match in UUID_RE.findall(html):
                    if match != project_id:
                        candidates.add(match)
                if any(status == "MEDIA_GENERATION_STATUS_SUCCESSFUL" for status in statuses.values()):
                    break
        finally:
            page.remove_listener("response", on_response)

        ordered = sorted(
            candidates,
            key=lambda candidate: (
                statuses.get(candidate) != "MEDIA_GENERATION_STATUS_SUCCESSFUL",
                candidate,
            ),
        )
        recovered: list[str] = []
        for media_id in ordered:
            target = destination_dir / f"{media_id}.mp4"
            try:
                await client.download_video(media_id, target)
            except Exception:
                continue
            header = target.read_bytes()[:16]
            if b"ftyp" not in header and not header.startswith(b"\x1aE\xdf\xa3"):
                target.unlink(missing_ok=True)
                continue
            recovered.append(str(target))
            break

    print(
        json.dumps(
            {
                "project_id": project_id,
                "candidate_count": len(candidates),
                "statuses": statuses,
                "observed_route_count": len(observed_routes),
                "recovered": recovered,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if recovered else 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_id")
    parser.add_argument("destination_dir", type=Path)
    parser.add_argument("--wait-seconds", type=int, default=60)
    return parser.parse_args()


if __name__ == "__main__":
    cli_args = parse_args()
    if cli_args.wait_seconds < 1 or cli_args.wait_seconds > 600:
        raise SystemExit("--wait-seconds must be between 1 and 600")
    raise SystemExit(
        asyncio.run(
            recover(cli_args.project_id, cli_args.destination_dir, cli_args.wait_seconds)
        )
    )

