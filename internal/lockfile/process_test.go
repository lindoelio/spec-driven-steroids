package lockfile

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// TestALockOfALiveProcessIsNotTaken checks that a lock held by another
// process is waited for, never taken.
//
// The holder is another process, so the check runs against the real thing:
// the lock of a process that holds it must never be taken, and it must
// become available once that process releases it.
func TestALockOfALiveProcessIsNotTaken(t *testing.T) {
	dir := t.TempDir()
	marker := filepath.Join(dir, "held")

	if os.Getenv("SDS_LOCK_HOLDER") == "1" {
		release, err := Acquire(os.Getenv("SDS_LOCK_DIR"), ".holder.lock", 5*time.Second)
		if err != nil {
			os.Exit(2)
		}
		_ = os.WriteFile(filepath.Join(os.Getenv("SDS_LOCK_DIR"), "held"), []byte("held"), 0o644)
		time.Sleep(2 * time.Second)
		release()
		os.Exit(0)
	}

	child := exec.Command(os.Args[0], "-test.run=TestALockOfALiveProcessIsNotTaken")
	child.Env = append(os.Environ(), "SDS_LOCK_HOLDER=1", "SDS_LOCK_DIR="+dir)
	if err := child.Start(); err != nil {
		t.Fatalf("start the holder: %v", err)
	}
	defer child.Wait()

	for attempt := 0; attempt < 150; attempt++ {
		if _, err := os.Stat(marker); err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatal("the holder never took the lock")
	}

	acquired := make(chan error, 1)
	go func() {
		release, err := Acquire(dir, ".holder.lock", 10*time.Second)
		if err == nil {
			release()
		}
		acquired <- err
	}()

	select {
	case err := <-acquired:
		t.Fatalf("the lock of a live process was taken: %v", err)
	case <-time.After(time.Second):
	}

	select {
	case err := <-acquired:
		if err != nil {
			t.Errorf("the lock was not taken after the holder released it: %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the lock was never taken after the holder released it")
	}
}
