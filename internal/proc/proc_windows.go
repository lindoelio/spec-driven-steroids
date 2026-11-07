//go:build windows

// Package proc answers whether a process is still running.
//
// The lock files record the process that owns them, so a lock left by a
// process that died can be recovered instead of blocking the next writer.
package proc

import "syscall"

// stillActive is the exit code of a process that is still running.
const stillActive = 259

// Alive reports whether the process with the given id is still running.
//
// Windows has no signal zero, so the process is opened for a query and its
// exit code is read. A terminated process keeps its exit code, so the query
// succeeds even after the process is gone: the exit code is what tells the
// two apart. A permission error means the process exists and belongs to
// another user, so it is alive as well.
func Alive(pid int) bool {
	handle, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION, false, uint32(pid))
	if err != nil {
		return err == syscall.ERROR_ACCESS_DENIED
	}
	defer syscall.CloseHandle(handle)

	var code uint32
	if err := syscall.GetExitCodeProcess(handle, &code); err != nil {
		// The exit code could not be read, so the process is assumed to
		// be alive: a wrong "alive" costs a wait, a wrong "gone" costs
		// the claims of another platform.
		return true
	}
	return code == stillActive
}
