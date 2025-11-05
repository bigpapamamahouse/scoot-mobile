/**
 * DEPRECATED: This file now re-exports from CurrentUserContext.
 * The global context prevents duplicate API calls across components.
 *
 * All new code should import directly from '../contexts/CurrentUserContext'
 */
export { useCurrentUser, isOwner } from '../contexts/CurrentUserContext';
