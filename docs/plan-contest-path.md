# Contest folder path customization plan

## Goal

Enable configuring the base directory for contest folders, defaulting to `contests/` at the workspace root (e.g., `contests/abc001/...`). Bump extension version to 2.1.0 and update docs (README, CHANGELOG).

## Steps

1. Discover current contest folder creation logic and configuration surface: locate where contest directories are computed and created; identify config schemas/types and user-facing settings.
2. Design setting for base contest directory: decide config key, default `contests`, ensure path is relative to workspace root, and resolve to absolute paths for creation.
3. Implement setting support: extend config/types, propagate to contest creation logic, and adjust path resolution to use the new base directory while preserving prior behavior via default.
4. Update user docs and metadata: bump package.json version to 2.1.0, document the new setting and default in README, and add a CHANGELOG entry describing the feature.
5. Verify: quick review of affected files and ensure paths resolve to `contests/<contest>/...` by default.
