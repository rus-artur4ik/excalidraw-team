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

const visibilityLabel = (board: Board): string => {
  if (board.visibility === "team" || board.teamId) {
    return "👥 команда";
  }
  if (board.visibility === "link" || board.readPolicy === "public") {
    return "🔗 по ссылке";
  }
  return "🔒 личная";
};

export const BoardCard = ({
  board,
  canManage,
  onSettings,
  roomKey,
}: {
  board: Board;
  canManage: boolean;
  onSettings: () => void;
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
          <span style={badge}>{visibilityLabel(board)}</span>
          <span style={badge}>bot: {board.botPolicy ?? "write"}</span>
          {canManage && (
            <button
              style={{ ...linkBtn, marginLeft: "auto" }}
              onClick={onSettings}
            >
              Настройки
            </button>
          )}
        </div>
      </div>
    </li>
  );
};
