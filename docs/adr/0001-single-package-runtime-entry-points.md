# Single package with runtime entry points

The extracted SDK is published as one npm package with root, `/react`, and `/server` entry points instead of three independently versioned packages. The three parts share the same init-data and launch-parameter model and currently change together; separate packages would add release and dependency-alignment complexity without a demonstrated consumer need. Explicit entry points still keep the framework-neutral client, React, and Node.js runtime boundaries from leaking into one another.
