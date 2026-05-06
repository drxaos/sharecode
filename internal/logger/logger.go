package logger

import (
	"log"
	"sync/atomic"
)

var debugEnabled atomic.Bool

func SetDebug(enabled bool) {
	debugEnabled.Store(enabled)
}

func Debug(format string, args ...any) {
	if debugEnabled.Load() {
		log.Printf(format, args...)
	}
}
