from __future__ import annotations

import sys
import subprocess
from pathlib import Path

import streamlit as st

# --- Ensure project root import works ---
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.ui.html_embed import embed_html  # noqa: E402

VIZ_DIR = BASE_DIR / "visualizations"


def run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    """Run a subprocess from project root using the current venv python."""
    if cmd and cmd[0] == "python":
        cmd = [sys.executable] + cmd[1:]
    p = subprocess.run(cmd, cwd=str(BASE_DIR), capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def open_in_browser(path: Path) -> None:
    """Best-effort open on macOS."""
    try:
        subprocess.run(["open", str(path)], check=False)
    except Exception:
        pass


def viz_page(
    title: str,
    html_path: Path,
    regen_cmd: list[str] | None = None,
    height: int = 950,
) -> None:
    """
    Main UX:
      - If HTML exists: embed immediately.
      - Controls are tucked into an "Advanced" expander.
      - If HTML missing: show Regenerate.
    """
    st.title(title)

    if html_path.exists():
        embed_html(html_path, height=height)

        with st.expander("Advanced", expanded=False):
            c1, c2 = st.columns([1, 1])
            with c1:
                if st.button("Open in browser", use_container_width=True, key=f"open_{html_path.name}"):
                    open_in_browser(html_path)

            with c2:
                if regen_cmd is not None and st.button(
                    "Regenerate", use_container_width=True, key=f"regen_{html_path.name}"
                ):
                    with st.status("Running generator…", expanded=True) as status:
                        code, out, err = run_cmd(regen_cmd)
                        if out.strip():
                            st.code(out)
                        if err.strip():
                            st.code(err)
                        if code == 0:
                            status.update(label="Done", state="complete")
                            st.rerun()
                        else:
                            status.update(label="Failed", state="error")
                            st.error("Generator failed. See logs above.")

        return

    # Missing HTML
    st.info(f"HTML not found yet: `{html_path}`")

    if regen_cmd is None:
        st.caption("No generator command is configured for this view.")
        return

    st.caption("Click **Regenerate** to create it.")
    if st.button("Regenerate", key=f"regen_{html_path.name}_missing"):
        with st.status("Running generator…", expanded=True) as status:
            code, out, err = run_cmd(regen_cmd)
            if out.strip():
                st.code(out)
            if err.strip():
                st.code(err)
            if code == 0:
                status.update(label="Done", state="complete")
                st.rerun()
            else:
                status.update(label="Failed", state="error")
                st.error("Generator failed. See logs above.")


def main() -> None:
    st.set_page_config(page_title="Movie Mood Dashboard", layout="wide")

    st.sidebar.title("Movie Mood")

    page = st.sidebar.selectbox(
        "Navigate",
        [
            "Home",
            "Recommendations",
            "Semantic Taste Map (UMAP)",
            "People Network",
            "Movies Sunburst",
            "Movies Force Network",
        ],
        key="main_nav",
    )

    # Expected files
    umap_html = VIZ_DIR / "umap_map.html"
    people_html = VIZ_DIR / "people_network.html"
    sunburst_html = VIZ_DIR / "movies_sunburst.html"
    force_html = VIZ_DIR / "movies_force_network.html"
    recs_html = VIZ_DIR / "recommendations.html"

    if page == "Home":
        st.title("Home")
        st.caption("Landing page (blank for now).")
        st.markdown(
            """
            Use the sidebar to navigate:
            - **Recommendations**: pick clusters and generate poster-card recs  
            - **Semantic Taste Map (UMAP)**: your movie taste map projection  
            - **People Network**: director/writer/actor collaboration graph  
            - **Movies Sunburst** / **Movies Force Network**: cluster visualizations  
            """
        )

    elif page == "Recommendations":
        st.title("Recommendations")
        st.caption("Pick clusters → generate poster-card recommendations.")

        # Embed the cluster picker UI (no set_page_config inside render())
        try:
            from src.ui.cluster_picker_app import render as cluster_picker_render  # noqa: E402
            cluster_picker_render()
        except Exception as e:
            st.error("Cluster picker failed to load.")
            st.exception(e)

        st.divider()
        st.subheader("Latest recommendations output")

        if recs_html.exists():
            embed_html(recs_html, height=1100)
            with st.expander("Advanced", expanded=False):
                c1, c2 = st.columns([1, 1])
                with c1:
                    if st.button("Open in browser", key="open_recs_html"):
                        open_in_browser(recs_html)
                with c2:
                    st.code(str(recs_html))
        else:
            st.info("No recommendations.html found yet. Generate recommendations above.")

    elif page == "Semantic Taste Map (UMAP)":
        viz_page(
            "Semantic Taste Map (UMAP)",
            umap_html,
            regen_cmd=["python", "-m", "src.visualization.01_umap_map"],
            height=900,
        )

    elif page == "People Network":
        viz_page(
            "People Network",
            people_html,
            regen_cmd=["python", "-m", "src.visualization.03_people_network"],
            height=950,
        )

    elif page == "Movies Sunburst":
        viz_page(
            "Movies Sunburst",
            sunburst_html,
            regen_cmd=["python", "-m", "src.visualization.04_movies_sunburst"],
            height=950,
        )

    elif page == "Movies Force Network":
        viz_page(
            "Movies Force Network",
            force_html,
            regen_cmd=["python", "-m", "src.visualization.05_movie_force_network"],
            height=950,
        )


if __name__ == "__main__":
    main()