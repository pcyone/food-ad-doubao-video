#!/opt/gflow-venv/bin/python
"""Submit one existing Flow project and print only safe HTTP evidence."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from gflow_cli.api.client import FlowApiClient
from gflow_cli.api.transports.ui_automation_video import VideoGenerationMixin


async def submit(project_id: str, prompt_file: Path) -> int:
    prompt = prompt_file.read_text(encoding="utf-8").strip()
    if not prompt:
        raise RuntimeError("prompt is empty")

    async with FlowApiClient(
        profile_dir=Path("/data/gflow/profile_flow"),
        out_dir=Path("/tmp/food-ad-flow-diagnostics"),
    ) as client:
        page = client._page
        transport = client.transport
        if page is None or transport is None:
            raise RuntimeError("Flow page or transport not initialized")

        await transport._enter_editor(page, None, project_id=project_id)
        await transport._dismiss_blocking_overlays(page, None)
        captured, handler = VideoGenerationMixin._attach_video_response_listener(page)
        try:
            input_box = await transport._locate_prompt_box(page, None)
            await input_box.click()
            await page.keyboard.press("Control+A")
            await page.keyboard.press("Delete")
            await page.keyboard.insert_text(prompt)
            await page.wait_for_timeout(700)

            submit_ready = False
            for _ in range(20):
                submit_ready = await page.evaluate(
                    """() => {
                      const buttons = [...document.querySelectorAll('button')].filter((node) =>
                        [...node.querySelectorAll('i.google-symbols')].some(
                          (icon) => (icon.textContent || '').trim() === 'arrow_forward'
                        )
                      );
                      if (buttons.length !== 1 || buttons[0].disabled) return false;
                      const rect = buttons[0].getBoundingClientRect();
                      return rect.width > 0 && rect.height > 0;
                    }"""
                )
                if submit_ready:
                    break
                await page.wait_for_timeout(500)
            if not submit_ready:
                raise RuntimeError("the unique Flow video-submit button did not become ready")

            await input_box.click()
            submit_focused = False
            for _ in range(8):
                await page.keyboard.press("Tab")
                submit_focused = await page.evaluate(
                    """() => {
                      const node = document.activeElement;
                      if (!node || node.tagName !== 'BUTTON' || node.disabled) return false;
                      return [...node.querySelectorAll('i.google-symbols')].some(
                        (icon) => (icon.textContent || '').trim() === 'arrow_forward'
                      );
                    }"""
                )
                if submit_focused:
                    break
            if not submit_focused:
                raise RuntimeError("the unique Flow video-submit button was not reachable")

            await page.keyboard.press("Enter")
            response = await VideoGenerationMixin._await_generate_response(
                captured, timeout_s=90.0
            )
            http_status = int(response.get("status") or 0)
            if http_status != 200:
                raise RuntimeError(f"Flow submit returned HTTP {http_status}")
            media_id, operation_id = VideoGenerationMixin._parse_generate_response(response)
        finally:
            page.remove_listener("response", handler)

    print(
        json.dumps(
            {
                "project_id": project_id,
                "submitted": True,
                "http_status": http_status,
                "media_id": media_id,
                "operation_id_present": bool(operation_id),
            },
            indent=2,
        )
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_id")
    parser.add_argument("prompt_file", type=Path)
    return parser.parse_args()


if __name__ == "__main__":
    cli_args = parse_args()
    raise SystemExit(asyncio.run(submit(cli_args.project_id, cli_args.prompt_file)))

