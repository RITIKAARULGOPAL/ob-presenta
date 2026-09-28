import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from './editorStore';
import { makeId } from './id';
import type { Project } from '@/types/slide';

// Keeps the audience screen (Presenter) and the presenter view (the laptop
// window with notes, timer and next slide) on the same slide and the same
// black-screen state. Both are windows of the same browser, so a
// BroadcastChannel reaches between them with no server involved; each window
// runs its own copy of the editor store, and this is the only thing linking
// them.
//
// Either window can drive. A change made in one is sent as a message and
// applied by the other; changes applied *from* a message are never sent back,
// so nothing echoes. If both windows move at the same moment, every message
// carries the time it happened and the later one wins on both sides, so they
// can't settle on different slides.
//
// The audience screen owns the deck: the presenter view asks for it rather
// than fetching its own copy, so the two can't disagree about content (a save
// landing between two separate fetches would otherwise do exactly that). It
// only loads the deck itself when no audience screen answers.

type Message = { from: string } & (
  /** Presenter view → audience: "send me the deck and where you are". */
  | { type: 'hello' }
  /** Audience → presenter view: "I've just opened", so a presenter view that
   *  was already waiting asks again. */
  | { type: 'announce' }
  | { type: 'state'; project: Project; slideId: string | null; navAt: number; black: boolean; blackAt: number }
  | { type: 'goto'; slideId: string; at: number }
  | { type: 'black'; on: boolean; at: number }
  /** Audience → presenter view: closing, reloading or leaving for the editor. */
  | { type: 'bye' }
);

function channelName(projectId: string): string {
  return `presenta:present:${projectId}`;
}

/** Later wins; a same-millisecond tie goes to the higher window id, which
 *  both sides compute the same way. */
function isNewer(at: number, from: string, lastAt: number, self: string): boolean {
  return at > lastAt || (at === lastAt && from > self);
}

export function usePresenterSync({
  projectId,
  role,
  active,
  black,
  onBlack,
  onState,
  onPeerJoined,
}: {
  projectId: string;
  role: 'audience' | 'view';
  /** Once the deck is loaded. Until then nothing is sent, so a window still
   *  picking its first slide can't pull the other one there. */
  active: boolean;
  black: boolean;
  /** Apply a black-screen change that came from the other window. */
  onBlack: (on: boolean) => void;
  /** Presenter view only: take over the audience screen's deck and slide. */
  onState?: (project: Project, slideId: string | null) => void;
  /** Audience only: a presenter view just connected. */
  onPeerJoined?: () => void;
}): {
  /** Presenter view only: an audience screen is answering. */
  connected: boolean;
  /** Set black on or off here and on the other screen. */
  setBlack: (on: boolean) => void;
} {
  const [self] = useState(() => makeId('win'));
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  // Time of the last navigation/black change this window made or accepted.
  const navAtRef = useRef(0);
  const blackAtRef = useRef(0);
  // Set while applying a remote change, so the store subscription below
  // doesn't mistake it for a local one and send it straight back.
  const applyingRef = useRef(false);

  const latest = useRef({ active, black, onBlack, onState, onPeerJoined });
  useEffect(() => {
    latest.current = { active, black, onBlack, onState, onPeerJoined };
  });

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(channelName(projectId));
    channelRef.current = channel;
    const post = (m: Message) => channel.postMessage(m);

    function applyRemote(fn: () => void) {
      applyingRef.current = true;
      try {
        fn();
      } finally {
        applyingRef.current = false;
      }
    }

    channel.onmessage = (event: MessageEvent<Message>) => {
      const m = event.data;
      if (!m || m.from === self) return;
      const l = latest.current;
      switch (m.type) {
        case 'hello': {
          if (role !== 'audience' || !l.active) return;
          const { project, currentSlideId } = useEditorStore.getState();
          if (!project) return;
          post({
            type: 'state',
            from: self,
            project,
            slideId: currentSlideId,
            navAt: navAtRef.current,
            black: l.black,
            blackAt: blackAtRef.current,
          });
          l.onPeerJoined?.();
          return;
        }
        case 'announce':
          if (role === 'view') post({ type: 'hello', from: self });
          return;
        case 'state':
          if (role !== 'view') return;
          // Always taken whole: a state only ever arrives because this view
          // just opened, or because an audience screen just did, and either
          // way the audience's slide is where the presentation is.
          navAtRef.current = m.navAt;
          blackAtRef.current = m.blackAt;
          applyRemote(() => {
            l.onState?.(m.project, m.slideId);
            l.onBlack(m.black);
          });
          setConnected(true);
          return;
        case 'goto': {
          if (role === 'view') setConnected(true);
          if (!isNewer(m.at, m.from, navAtRef.current, self)) return;
          const store = useEditorStore.getState();
          if (!store.project?.slides.some((s) => s.id === m.slideId)) return;
          navAtRef.current = m.at;
          if (store.currentSlideId !== m.slideId) applyRemote(() => store.selectSlide(m.slideId));
          return;
        }
        case 'black':
          if (role === 'view') setConnected(true);
          if (!isNewer(m.at, m.from, blackAtRef.current, self)) return;
          blackAtRef.current = m.at;
          applyRemote(() => l.onBlack(m.on));
          return;
        case 'bye':
          if (role === 'view') setConnected(false);
          return;
      }
    };

    if (role === 'view') post({ type: 'hello', from: self });

    // Unmounting covers leaving for the editor; pagehide covers closing the
    // window or reloading it, when React never gets to unmount anything.
    const sayBye = () => {
      if (role === 'audience') post({ type: 'bye', from: self });
    };
    window.addEventListener('pagehide', sayBye);
    return () => {
      window.removeEventListener('pagehide', sayBye);
      sayBye();
      channel.close();
      channelRef.current = null;
    };
  }, [projectId, role, self]);

  // An audience screen that finishes loading after the presenter view opened
  // says so, and the waiting view asks for the deck again.
  useEffect(() => {
    if (role === 'audience' && active) channelRef.current?.postMessage({ type: 'announce', from: self } satisfies Message);
  }, [role, active, self]);

  // Every slide change made here goes out, whatever caused it: the keyboard,
  // a swipe, a nav dot, or a Linked Views hotspot jumping to another slide.
  useEffect(
    () =>
      useEditorStore.subscribe((state, prev) => {
        if (state.currentSlideId === prev.currentSlideId || !state.currentSlideId || applyingRef.current) return;
        const at = Date.now();
        navAtRef.current = at;
        if (!latest.current.active) return;
        channelRef.current?.postMessage({ type: 'goto', from: self, slideId: state.currentSlideId, at } satisfies Message);
      }),
    [self],
  );

  function setBlack(on: boolean) {
    const at = Date.now();
    blackAtRef.current = at;
    latest.current.onBlack(on);
    channelRef.current?.postMessage({ type: 'black', from: self, on, at } satisfies Message);
  }

  return { connected, setBlack };
}
