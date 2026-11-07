package lockfile

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

// TestTheLockIsExclusive checks that a second writer waits for the lock.
func TestTheLockIsExclusive(t *testing.T) {
	dir := t.TempDir()

	release, err := Acquire(dir, ".test.lock", time.Second)
	if err != nil {
		t.Fatalf("acquire the lock: %v", err)
	}
	defer release()

	acquired := make(chan error, 1)
	go func() {
		second, err := Acquire(dir, ".test.lock", 5*time.Second)
		if err == nil {
			second()
		}
		acquired <- err
	}()

	select {
	case err := <-acquired:
		t.Fatalf("the second writer acquired the lock while it was held: %v", err)
	case <-time.After(200 * time.Millisecond):
	}

	release()
	select {
	case err := <-acquired:
		if err != nil {
			t.Fatalf("the second writer failed to acquire the released lock: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the second writer did not acquire the released lock")
	}
}

// TestALockWithoutAnOwnerIsNotTaken checks that the lock of a process that is
// taking it right now is never taken from it.
//
// The file of a lock is created before the owner is written inside it, so a
// reader that finds an empty file faces a window, not a leftover.
func TestALockWithoutAnOwnerIsNotTaken(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".test.lock")

	// The file exists, but the owner has not been written yet.
	if err := os.WriteFile(path, nil, 0o644); err != nil {
		t.Fatalf("create the lock: %v", err)
	}

	if reclaimable(path) {
		t.Error("a lock that is being taken right now was reported as reclaimable")
	}

	release, err := Acquire(dir, ".test.lock", 100*time.Millisecond)
	if err == nil {
		release()
		t.Fatal("the lock of another writer was taken while it was being taken")
	}
}

// TestALockOfADeadProcessIsTakenBack checks that a lock left by a process that
// died does not block the next writer.
func TestALockOfADeadProcessIsTakenBack(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".test.lock")

	// The owner is a process that does not exist.
	if err := os.WriteFile(path, []byte(strconv.Itoa(deadProcessID())), 0o644); err != nil {
		t.Fatalf("create the lock: %v", err)
	}

	if !reclaimable(path) {
		t.Error("the lock of a process that is gone was not reported as reclaimable")
	}

	release, err := Acquire(dir, ".test.lock", time.Second)
	if err != nil {
		t.Fatalf("acquire the lock left behind: %v", err)
	}
	release()
}

// TestAnOldLockIsTakenBack checks that a lock whose owner looks alive is
// taken back when it grows too old.
//
// The process id of a lock can be reused by another process, and a reused id
// would keep the lock forever.
func TestAnOldLockIsTakenBack(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".test.lock")

	if err := os.WriteFile(path, []byte(strconv.Itoa(os.Getpid())), 0o644); err != nil {
		t.Fatalf("create the lock: %v", err)
	}
	old := time.Now().Add(-StaleAfter - time.Minute)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatalf("age the lock: %v", err)
	}

	if !reclaimable(path) {
		t.Error("an old lock was not reported as reclaimable")
	}
}

// deadProcessID returns a process id that no process holds.
func deadProcessID() int {
	return 1 << 22
}
