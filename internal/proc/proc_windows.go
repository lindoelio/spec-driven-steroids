//go:build windows

// Package proc answers whether a process is still running.
//
// The lock files record the process that owns them, so a lock left by a
// process that died can be recovered instead of blocking the next writer.
package proc

import "syscall"

// waitObjectZero is the state of a handle whose process has finished.
const waitObjectZero = syscall.WAIT_OBJECT_0

// Alive reports whether the process with the given id is still running.
//
// Windows has no signal zero, so the process is opened for a query and the
// handle is waited on without waiting at all. A process that has finished
// signals its handle, and one that is still running does not. The exit code
// would not tell the two apart, because a process may return the code that
// means "still running" as its own.
//
// A permission error means the process exists and belongs to another user,
// so it is alive as well.
func Alive(pid int) bool {
	handle, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION|syscall.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		return err == syscall.ERROR_ACCESS_DENIED
	}
	defer syscall.CloseHandle(handle)

	state, waitErr := syscall.WaitForSingleObject(handle, 0)
	if waitErr != nil {
		// The state could not be read, so the process is assumed to be
		// alive: a wrong "alive" costs a wait, a wrong "gone" costs the
		// claims of another platform.
		return true
	}
	if state == waitObjectZero {
		// The process finished and signalled its handle.
		return false
	}
	return true
}
