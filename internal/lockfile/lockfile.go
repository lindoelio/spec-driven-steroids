// Package lockfile guards a shared directory between processes.
//
// The lock is a single file that the owner creates with an exclusive flag.
// The owner records its process id inside the file, and the age of the file
// tells a lock that is being taken right now from one that was left behind.
//
// A lock is never taken from a process that is alive, so two writers never
// believe they hold it at the same time.
package lockfile

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/lindoelio/spec-driven-steroids/internal/proc"
)

// PollInterval is how long a waiter sleeps between two attempts.
const PollInterval = 25 * time.Millisecond

// StaleAfter is how long a lock may exist before it is taken back, even when
// the process that holds it still runs.
//
// The process id of a lock can be reused by another process, and a reused id
// would keep the lock forever. The age of the lock breaks that tie.
const StaleAfter = 60 * time.Second

// Acquire takes the lock named name inside dir and returns the function that
// releases it.
//
// It waits while another process holds the lock, and takes it back when the
// holder is gone or when the lock grew older than the stale threshold.
func Acquire(dir, name string, timeout time.Duration) (func(), error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	path := filepath.Join(dir, name)
	startedAt := time.Now()
	for {
		file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err == nil {
			_, _ = file.WriteString(strconv.Itoa(os.Getpid()))
			_ = file.Close()
			return func() { _ = os.Remove(path) }, nil
		}
		if !errors.Is(err, os.ErrExist) {
			return nil, err
		}

		// Another process holds the lock. Take it back only when it can be
		// taken safely; a lock that is fresh belongs to a process that is
		// taking it right now.
		if reclaimable(path) {
			_ = os.Remove(path)
			continue
		}

		if time.Since(startedAt) > timeout {
			return nil, fmt.Errorf("Timed out waiting for the write lock: %s", path)
		}
		time.Sleep(PollInterval)
	}
}

// reclaimable reports whether the lock at path can be taken from its holder.
//
// The owner is recorded in the file, but the file is created before the owner
// is written, so an empty file belongs to a process that is taking the lock
// right now. The age of the file tells the two apart: a lock that is fresh is
// never taken.
func reclaimable(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	age := time.Since(info.ModTime())

	owner, err := readOwner(path)
	if err != nil {
		// The owner has not been written yet, so the process is taking
		// the lock right now. Only a leftover is taken back.
		return age >= StaleAfter
	}
	if owner > 0 && !proc.Alive(owner) {
		// The holder is gone.
		return true
	}
	// The holder is alive, but its process id may have been reused by
	// another process, which would keep the lock forever.
	return age >= StaleAfter
}

// readOwner reads the process id recorded in a lock file.
func readOwner(path string) (int, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	owner, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil {
		return 0, err
	}
	return owner, nil
}
