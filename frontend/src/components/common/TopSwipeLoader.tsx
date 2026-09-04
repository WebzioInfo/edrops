/**
 * Re-exporting from CenteredPageLoader for backward compatibility.
 * Route transitions, back/forward navigation, and async data-fetching loaders
 * are centered in the viewport.
 */
export {
  usePageLoader,
  useTopPageLoader,
  CenteredPageLoader,
  TopSwipeLoader,
  GlobalCenteredPageLoader,
  GlobalTopSwipeLoader,
} from './CenteredPageLoader';

export { default } from './CenteredPageLoader';
