package proc

import (
	"os"
	"os/exec"
	"runtime"
	"testing"
	"time"
)

// TestTheRunningProcessIsAlive checks that the process running the test
// reports itself as alive.
//
// The lock files record the process that owns them, so the check must
// recognize the process that is certainly running.
func TestTheRunningProcessIsAlive(t *testing.T) {
	if !Alive(os.Getpid()) {
		t.Error("the running process is reported as gone")
	}
}

// TestAProcessThatFinishedIsNotAlive checks that a process that ended is
// reported as gone.
//
// The lock of a process that died must be recoverable, so the check must
// tell a finished process from a running one.
func TestAProcessThatFinishedIsNotAlive(t *testing.T) {
	var command *exec.Cmd
	if runtime.GOOS == "windows" {
		command = exec.Command("cmd", "/c", "exit")
	} else {
		command = exec.Command("sh", "-c", "exit 0")
	}
	if err := command.Run(); err != nil {
		t.Fatalf("run the child process: %v", err)
	}
	pid := command.Process.Pid

	// The system may take a moment to release the process.
	for attempt := 0; attempt < 50 && Alive(pid); attempt++ {
		time.Sleep(20 * time.Millisecond)
	}
	if Alive(pid) {
		t.Errorf("the process %d finished, but it is reported as alive", pid)
	}
}
