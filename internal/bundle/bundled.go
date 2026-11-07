package bundle

import (
	"errors"
	"io"
	"io/fs"
	"strings"
	"time"

	"github.com/lindoelio/spec-driven-steroids/internal/assets"
)

// The embedded tree carries the canonical artifacts without the "universal"
// directory a remote bundle wraps them in. The adapter below exposes the
// tree under that prefix, so both sources answer the same keys.
//
// universalPrefix is the directory the canonical tree lives under in a
// remote bundle.
const universalPrefix = "universal"

// bundledFS is the embedded tree, exposed under the remote bundle layout.
var bundledFS fs.FS = prefixedFS{base: canonicalTree(), prefix: universalPrefix}

// BundledFS returns the embedded canonical tree.
//
// The returned filesystem exposes the keys a remote bundle exposes, so
// "universal/skills/<skill>/SKILL.md" resolves for both sources.
func BundledFS() fs.FS { return bundledFS }

// canonicalTree returns the embedded tree, rooted at the tree itself.
func canonicalTree() fs.FS {
	tree := assets.CanonicalFS()
	if _, err := fs.Stat(tree, "skills"); err == nil {
		return tree
	}
	if sub, err := fs.Sub(tree, assets.CanonicalRoot); err == nil {
		if _, err := fs.Stat(sub, "skills"); err == nil {
			return sub
		}
	}
	return tree
}

// prefixedFS exposes a filesystem under one extra directory level.
type prefixedFS struct {
	base   fs.FS
	prefix string
}

// Open opens a file of the prefixed filesystem.
func (p prefixedFS) Open(name string) (fs.File, error) {
	if !fs.ValidPath(name) {
		return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrInvalid}
	}
	if name == "." {
		return &prefixedRoot{prefix: p.prefix}, nil
	}
	if name == p.prefix {
		return p.base.Open(".")
	}
	inner, ok := p.inner(name)
	if !ok {
		return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrNotExist}
	}
	return p.base.Open(inner)
}

// ReadDir lists a directory of the prefixed filesystem.
func (p prefixedFS) ReadDir(name string) ([]fs.DirEntry, error) {
	if !fs.ValidPath(name) {
		return nil, &fs.PathError{Op: "readdir", Path: name, Err: fs.ErrInvalid}
	}
	if name == "." {
		return []fs.DirEntry{fs.FileInfoToDirEntry(prefixedDirInfo{name: p.prefix})}, nil
	}
	if name == p.prefix {
		return fs.ReadDir(p.base, ".")
	}
	inner, ok := p.inner(name)
	if !ok {
		return nil, &fs.PathError{Op: "readdir", Path: name, Err: fs.ErrNotExist}
	}
	return fs.ReadDir(p.base, inner)
}

// inner returns the path of a prefixed path inside the base filesystem.
func (p prefixedFS) inner(name string) (string, bool) {
	prefix := p.prefix + "/"
	if !strings.HasPrefix(name, prefix) {
		return "", false
	}
	return strings.TrimPrefix(name, prefix), true
}

// prefixedRoot is the root directory of a prefixed filesystem. It holds the
// single directory the prefix names.
type prefixedRoot struct {
	prefix string
	read   bool
}

// Stat returns the description of the root directory.
func (f *prefixedRoot) Stat() (fs.FileInfo, error) {
	return prefixedDirInfo{name: f.prefix}, nil
}

// Read is not supported: the root is a directory.
func (f *prefixedRoot) Read([]byte) (int, error) {
	return 0, &fs.PathError{Op: "read", Path: f.prefix, Err: errors.New("is a directory")}
}

// Close releases the root directory.
func (f *prefixedRoot) Close() error { return nil }

// ReadDir lists the entries of the root directory.
func (f *prefixedRoot) ReadDir(count int) ([]fs.DirEntry, error) {
	if f.read {
		return nil, io.EOF
	}
	f.read = true
	entries := []fs.DirEntry{fs.FileInfoToDirEntry(prefixedDirInfo{name: f.prefix})}
	if count > 0 && count < len(entries) {
		return entries[:count], nil
	}
	return entries, nil
}

// prefixedDirInfo describes a directory of a prefixed filesystem.
type prefixedDirInfo struct {
	name string
}

// Name returns the name of the directory.
func (d prefixedDirInfo) Name() string { return d.name }

// Size returns the size of the directory.
func (d prefixedDirInfo) Size() int64 { return 0 }

// Mode returns the mode of the directory.
func (d prefixedDirInfo) Mode() fs.FileMode { return fs.ModeDir | 0o555 }

// ModTime returns the modification time of the directory.
func (d prefixedDirInfo) ModTime() time.Time { return time.Time{} }

// IsDir reports that the entry is a directory.
func (d prefixedDirInfo) IsDir() bool { return true }

// Sys returns nothing.
func (d prefixedDirInfo) Sys() any { return nil }
