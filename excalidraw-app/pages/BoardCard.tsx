import { useEffect, useState } from "react";

import { loadBoardThumbnail } from "../data/boardThumbnail";
import { navigate } from "../router";

import {
  badge,
  boardCard,
  linkBtn,
  skeletonShimmer,
  thumbBox,
  thumbImg,
} from "./pageStyles";

import type { Board } from "../data/boards";

export const BoardCard = ({
  board,
  owned,
  onAccess,
  roomKey,
}: {
  board: Board;
  owned: boolean;
  onAccess: () => void;
  roomKey: string | null;
}) => {
  const [thumb, setThumb] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(true);

  useEffect(() => {
    if (!roomKey) {
      return;
    }
    let active = true;
    setLoadingThumb(true);
    loadBoardThumbnail({ roomId: board.roomId, roomKey })
      .then((dataUrl) => {
        if (active) {
          setThumb(dataUrl);
        }
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (active) {
          setLoadingThumb(false);
        }
      });
    return () => {
      active = false;
    };
  }, [board.roomId, roomKey]);

  const open = () => navigate(`/b/${board.roomId}`);

  return (
    <li style={boardCard}>
      <div style={thumbBox} onClick={open}>
        {thumb ? (
          <img src={thumb} alt="" style={thumbImg} />
        ) : loadingThumb ? (
          <div style={skeletonShimmer} />
        ) : (
          <span style={{ color: "#bbb", fontSize: 13 }}>No preview yet</span>
        )}
      </div>
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <strong
          onClick={open}
          style={{ cursor: "pointer" }}
          title={board.title || "Untitled"}
        >
          {board.title || "Untitled"}
        </strong>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={badge}>{board.type === "team" ? "team" : "personal"}</span>
          <span style={badge}>bot: {board.botPolicy ?? "write"}</span>
          {owned && (
            <button style={{ ...linkBtn, marginLeft: "auto" }} onClick={onAccess}>
              Access
            </button>
          )}
        </div>
      </div>
    </li>
  );
};
