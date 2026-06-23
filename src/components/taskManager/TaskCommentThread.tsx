import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { TaskComment, FileViewerItem } from '../../types';
import { Paperclip, Play, Reply, Trash2 } from 'lucide-react';
import { useLongPress } from '../../hooks/useLongPress';
import { useTaskCommentStore } from '../../stores/taskCommentStore';
import { useUIStore } from '../../stores/uiStore';
import { getFileCategory, inferMimeTypeFromDataUrl, synthesizeAttachmentName } from '../../utils/fileType';

interface TaskCommentThreadProps {
  comments: TaskComment[];
  onReplyComment?: (comment: TaskComment) => void;
}

const DELETE_WINDOW_MS = 5 * 60 * 1000;

function formatAttachmentSize(bytes?: number): string | undefined {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCommentAttachmentFile(comment: TaskComment): FileViewerItem | null {
  if (!comment.attachmentDataUrl) return null;

  const mimeType = comment.attachmentMimeType || inferMimeTypeFromDataUrl(comment.attachmentDataUrl);
  return {
    name: synthesizeAttachmentName(comment.attachmentName, mimeType),
    dataUrl: comment.attachmentDataUrl,
    mimeType,
    size: formatAttachmentSize(comment.attachmentSizeBytes),
    source: 'task-comment',
  };
}

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
  const fileItem = getCommentAttachmentFile(comment);
  if (!fileItem) return null;
  const category = getFileCategory(fileItem.name, fileItem.mimeType);
  const src = fileItem.dataUrl || fileItem.path || '';

  const handleClick = () => {
    onOpenFileViewer(fileItem);
  };

  if (category === 'image' && src) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="media-thumb"
        style={{ padding: 0, border: 'none', background: 'transparent' }}
      >
        <img
          src={src}
          alt={fileItem.name}
          style={{
            display: 'block',
            maxWidth: 200,
            width: 181,
            height: 'auto',
            objectFit: 'contain',
          }}
        />
      </button>
    );
  }

  if (category === 'video' && src) {
    if (!comment.attachmentPreviewDataUrl) {
      return (
        <button
          type="button"
          onClick={handleClick}
          className="row-xs c-ptr trans-opacity" style={{background:'transparent',padding:12,borderRadius:8,border:'none',color:'var(--c-accent-2)',fontSize:'var(--fs-xs)',width:'100%',textAlign:'left',height:'fit-content'}}
        >
          <Paperclip size={11} />
          <span className="trunc">{fileItem.name}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className="media-thumb"
        style={{ padding: 0, border: 'none', background: 'transparent' }}
      >
        <div style={{ position: 'relative' }}>
          <img
            src={comment.attachmentPreviewDataUrl}
            alt={fileItem.name}
            style={{
              display: 'block',
              maxWidth: 200,
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: '999px',
              background: 'rgba(0, 0, 0, 0.66)',
              color: '#fff',
            }}
          >
            <Play size={14} fill="currentColor" />
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="row-xs c-ptr trans-opacity" style={{background:'transparent',padding:12,borderRadius:8,border:'none',color:'var(--c-accent-2)',fontSize:'var(--fs-xs)',width:'100%',textAlign:'left',height:'fit-content'}}
    >
      <Paperclip size={11} />
      <span className="trunc">{fileItem.name}</span>
    </button>
  );
}

function CommentBubble({
  comment,
  onOpenFileViewer,
  onOpenMenu,
}: {
  comment: TaskComment;
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

  const hasAttachment = Boolean(comment.attachmentDataUrl);

  return (
    <div data-comment-id={comment.id} className="comment-thread">
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
              fontSize: 'var(--fs-sm)',
              marginBottom: 4,
              border: '1px solid var(--c-border-1)',
              cursor: 'pointer',
            }}
          >
            <div style={{ width: 2, borderRadius: 1, background: 'var(--c-accent-center-panel)', flexShrink: 0 }} />
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div className="semibold" style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-accent-center-panel)', marginBottom: 1 }}>
                {comment.replyTo.sender}
              </div>
              <div className="subtle trunc" style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
      <div className="flex-1 flex items-center justify-center" style={{color:'var(--c-text-3)',textAlign:'center',marginTop:8,marginBottom:8}}>
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
        {comments.map((comment) => (
          <CommentBubble
            key={comment.id}
            comment={comment}
            onOpenFileViewer={openFileViewer}
            onOpenMenu={handleOpenMenu}
          />
        ))}
      </div>

      {contextMenu && createPortal(
        <CommentContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          comment={contextMenu.comment}
          onReply={() => onReplyComment?.(contextMenu.comment)}
          onDelete={() => deleteComment(contextMenu.comment.id, contextMenu.comment.taskId)}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}
    </>
  );
}
