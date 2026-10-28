# Project rules
- Keep domain UI under `src/features` and route files as composition shells, preserving existing navigation and behavior.
- Initialize translations in Portuguese for SSR and restore browser language only after hydration to avoid mismatched initial rendering.
- Use the shared page metadata helper in every content route so browser tabs identify the current VELT module.