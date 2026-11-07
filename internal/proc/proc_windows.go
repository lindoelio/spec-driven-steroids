//go:build windows

// Package proc answers whether a process is still running.
//
// The lock files record the process that owns them, so a lock left by a
// process that died can be recovered instead of blocking the next writer.
package proc

import "syscall"

// Alive reports whether the process with the given id is still running.
//
// Windows has no signal zero, so the process is opened for a query, which
// fails when the process is gone. A permission error means the process
// exists and belongs to another user, so it is alive as well.
func Alive(pid int) bool {
	handle, err := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION, false, uint32(pid))
	if err != nil {
		return err == syscall.ERROR_ACCESS_DENIED
	}
	_ = syscall.CloseHandle(handle)
	return true
}
