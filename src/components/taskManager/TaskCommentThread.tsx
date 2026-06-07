import { useState, useRef, useEffect, useCallback } from 'react';
import type { TaskComment, FileViewerItem } from '../../types';
import { Paperclip, FileVideo, Reply, Trash2 } from 'lucide-react';
import { useLongPress } from '../../hooks/useLongPress';
import { useTaskCommentStore } from '../../stores/taskCommentStore';
import { useUIStore } from '../../stores/uiStore';
import { commentFileUrl } from '../../repositories/commentRepository';

interface TaskCommentThreadProps {
  comments: TaskComment[];
  onReplyComment?: (comment: TaskComment) => void;
}

const DELETE_WINDOW_MS = 5 * 60 * 1000;

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${time}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` ${time}`;
}

function getFileType(name: string): 'image' | 'video' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
  return 'other';
}

function canDeleteComment(comment: TaskComment): boolean {
  return Date.now() - comment.createdAt < DELETE_WINDOW_MS;
}

function CommentContextMenu({
  x,
  y,
  comment,
  onReply,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  comment: TaskComment;
  onReply: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const deletable = canDeleteComment(comment);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuW = 150;
  const menuH = 88;
  const left = Math.min(x, vw - menuW - 8);
  const top = Math.min(y, vh - menuH - 8);

  return (
    <div
      ref={menuRef}
      style={{ left, top, position: 'fixed', zIndex: 90, minWidth: 130 }}
      className="drop"
    >
      <button
        type="button"
        onClick={() => { onReply(); onClose(); }}
        className="drop-item"
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-background-4)'; }}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Reply size={12} />
        Reply
      </button>
      <button
        type="button"
        disabled={!deletable}
        onClick={() => {
          if (deletable) {
            onDelete();
            onClose();
          }
        }}
        className={`drop-item${deletable ? '' : ' cursor-not-allowed'}`}
        style={deletable ? {color:'var(--c-danger)'} : {color:'var(--c-text-2)'}}
        onMouseEnter={e => { if (deletable) e.currentTarget.style.background = 'var(rgba(239,68,68,0.1))'; }}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Trash2 size={12} />
        Delete
      </button>
    </div>
  );
}

function AttachmentPreview({
  comment,
  onOpenFileViewer,
}: {
  comment: TaskComment;
  onOpenFileViewer: (file: FileViewerItem) => void;
}) {
  // Prefer the rich file metadata returned by the server. Fall back to the
  // legacy `attachmentName` for backward compatibility with pre-migration
  // data (notably the local Dexie import path, Agent 7).
  const file = comment.file;
  const fileName = file?.originalName ?? comment.attachmentName;
  const fileId = comment.fileId ?? file?.id;

  if (!fileName) return null;

  const type = getFileType(fileName);
  const url = fileId ? commentFileUrl(fileId) : undefined;

  const handleClick = () => {
    const fileItem: FileViewerItem = {
      name: fileName,
      path: url,
      mimeType: file?.mimeType,
      size: comment.attachmentSize,
      source: 'task-comment',
    };
    onOpenFileViewer(fileItem);
  };

  if (type === 'image' && url) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="media-thumb" style={{maxWidth:200}}
      >
        <img
          src={url}
          alt={fileName}
          style={{width:'fit-content',height:'auto',maxHeight:200,objectFit:'contain',display:'flex',flexDirection:'column'}}
        />
      </button>
    );
  }

  if (type === 'video' && url) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="media-thumb" style={{maxWidth:280}}
      >
        <video
          src={url}
          preload="metadata"
          style={{width:'100%',height:'auto',maxHeight:200,pointerEvents:'none'}}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="row-xs c-ptr trans-opacity" style={{background:'transparent',padding:0,borderRadius:8,border:'none',color:'var(--c-info)',fontSize:'var(--fs-xs)',width:'100%',textAlign:'left',height:16}}
    >
      {type === 'video' ? <FileVideo size={11} /> : <Paperclip size={11} />}
      <span className="trunc">{fileName}</span>
      {comment.attachmentSize && (
        <span className="subtle">({comment.attachmentSize})</span>
      )}
    </button>
  );
}

function CommentBubble({
  comment,
  index,
  onOpenFileViewer,
  onOpenMenu,
}: {
  comment: TaskComment;
  index: number;
  onOpenFileViewer: (file: FileViewerItem) => void;
  onOpenMenu: (comment: TaskComment, pos: { x: number; y: number }) => void;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  const handleLongPress = useCallback(
    (pos: { x: number; y: number }) => {
      onOpenMenu(comment, pos);
    },
    [comment, onOpenMenu]
  );

  const longPressProps = useLongPress({ onLongPress: handleLongPress });

  const scrollToComment = (id: string) => {
    const el = document.querySelector(`[data-comment-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Only render the attachment row if we have something to show. The
  // legacy `attachmentDataUrl` field is no longer populated in the web
  // build; the attachment is rendered from `comment.file` (server) or
  // `comment.attachmentName` (legacy import).
  const hasAttachment = Boolean(
    comment.file?.id || comment.fileId || comment.attachmentName,
  );

  return (
    <div data-comment-id={comment.id} className="comment-thread">
      <div className="avatar shrink-0" style={{ fontSize: '10px', fontWeight: 700, paddingLeft: 0, paddingRight: 0, marginRight: 5, marginTop: 3 }}>
        {index}
      </div>
      <div className="comment-right-col">
        {comment.replyTo && (
          <div
            onClick={() => scrollToComment(comment.replyTo!.id)}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 6,
              background: 'var(--c-background-4)',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 'var(--fs-11)',
              marginBottom: 4,
              border: '1px solid var(--c-border-1)',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: 2, borderRadius: 1, background: 'var(--c-accent-center-panel)', flexShrink: 0 }} />
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div className="semibold" style={{ fontSize: 'var(--fs-10)', color: 'var(--c-accent-center-panel)', marginBottom: 1 }}>
                {comment.replyTo.sender}
              </div>
              <div className="subtle trunc" style={{ fontSize: 'var(--fs-10)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {comment.replyTo.text}
              </div>
            </div>
          </div>
        )}
        <div
          ref={bubbleRef}
          {...longPressProps}
          onContextMenu={(e) => {
            e.preventDefault();
            onOpenMenu(comment, { x: e.clientX, y: e.clientY });
          }}
          className="comment-bubble select-none c-ptr"
        >
          {comment.text && (
            <p className="txt-xs" style={{whiteSpace:'pre-wrap',color:'var(--c-text-1)'}}>{comment.text}</p>
          )}
          {hasAttachment && (
            <AttachmentPreview comment={comment} onOpenFileViewer={onOpenFileViewer} />
          )}
        </div>
      </div>
      <span className="meta comment-meta">
        {formatTimestamp(comment.createdAt)}
      </span>
      <span className="meta comment-author">
        {comment.sender ?? 'You'}
      </span>
    </div>
  );
}

export function TaskCommentThread({ comments, onReplyComment }: TaskCommentThreadProps) {
  const [contextMenu, setContextMenu] = useState<{
    comment: TaskComment;
    x: number;
    y: number;
  } | null>(null);
  const { deleteComment } = useTaskCommentStore();
  const openFileViewer = useUIStore((s) => s.openFileViewer);

  const handleOpenMenu = useCallback(
    (comment: TaskComment, pos: { x: number; y: number }) => {
      setContextMenu({ comment, x: pos.x, y: pos.y });
    },
    []
  );

  if (comments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{color:'var(--c-text-3)',textAlign:'center',marginTop:10,marginBottom:10}}>
        <div>
          <p className="txt-xs" style={{marginBottom:4}}>No comments yet.</p>
          <p className="txt-xs">Start the conversation below.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div id="task-comment-thread" className="ai-scroll flex-1 overflow-y-a py-3" style={{display:'flex',flexDirection:'column',gap:16}}>
        {comments.map((comment, index) => (
          <CommentBubble
            key={comment.id}
            comment={comment}
            index={index + 1}
            onOpenFileViewer={openFileViewer}
            onOpenMenu={handleOpenMenu}
          />
        ))}
      </div>

      {contextMenu && (
        <CommentContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          comment={contextMenu.comment}
          onReply={() => onReplyComment?.(contextMenu.comment)}
          onDelete={() => deleteComment(contextMenu.comment.id, contextMenu.comment.taskId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
