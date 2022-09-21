// Code generated by go-mockgen 1.3.4; DO NOT EDIT.
//
// This file was generated by running `sg generate` (or `go-mockgen`) at the root of
// this repository. To add additional mocks to this or another package, add a new entry
// to the mockgen.yaml file in the root of this repository.

package mocks

import (
	"sync"

	resolvers "github.com/sourcegraph/sourcegraph/enterprise/cmd/frontend/internal/codeintel/resolvers"
	graphql "github.com/sourcegraph/sourcegraph/internal/codeintel/autoindexing/transport/graphql"
	graphql2 "github.com/sourcegraph/sourcegraph/internal/codeintel/policies/transport/graphql"
	graphql3 "github.com/sourcegraph/sourcegraph/internal/codeintel/uploads/transport/graphql"
	graphql1 "github.com/sourcegraph/sourcegraph/internal/services/executors/transport/graphql"
)

// MockResolver is a mock implementation of the Resolver interface (from the
// package
// github.com/sourcegraph/sourcegraph/enterprise/cmd/frontend/internal/codeintel/resolvers)
// used for unit testing.
type MockResolver struct {
	// AutoIndexingRootResolverFunc is an instance of a mock function object
	// controlling the behavior of the method AutoIndexingRootResolver.
	AutoIndexingRootResolverFunc *ResolverAutoIndexingRootResolverFunc
	// CodeNavResolverFunc is an instance of a mock function object
	// controlling the behavior of the method CodeNavResolver.
	CodeNavResolverFunc *ResolverCodeNavResolverFunc
	// ExecutorResolverFunc is an instance of a mock function object
	// controlling the behavior of the method ExecutorResolver.
	ExecutorResolverFunc *ResolverExecutorResolverFunc
	// PoliciesRootResolverFunc is an instance of a mock function object
	// controlling the behavior of the method PoliciesRootResolver.
	PoliciesRootResolverFunc *ResolverPoliciesRootResolverFunc
	// UploadRootResolverFunc is an instance of a mock function object
	// controlling the behavior of the method UploadRootResolver.
	UploadRootResolverFunc *ResolverUploadRootResolverFunc
}

// NewMockResolver creates a new mock of the Resolver interface. All methods
// return zero values for all results, unless overwritten.
func NewMockResolver() *MockResolver {
	return &MockResolver{
		AutoIndexingRootResolverFunc: &ResolverAutoIndexingRootResolverFunc{
			defaultHook: func() (r0 graphql.RootResolver) {
				return
			},
		},
		CodeNavResolverFunc: &ResolverCodeNavResolverFunc{
			defaultHook: func() (r0 resolvers.CodeNavResolver) {
				return
			},
		},
		ExecutorResolverFunc: &ResolverExecutorResolverFunc{
			defaultHook: func() (r0 graphql1.Resolver) {
				return
			},
		},
		PoliciesRootResolverFunc: &ResolverPoliciesRootResolverFunc{
			defaultHook: func() (r0 graphql2.RootResolver) {
				return
			},
		},
		UploadRootResolverFunc: &ResolverUploadRootResolverFunc{
			defaultHook: func() (r0 graphql3.RootResolver) {
				return
			},
		},
	}
}

// NewStrictMockResolver creates a new mock of the Resolver interface. All
// methods panic on invocation, unless overwritten.
func NewStrictMockResolver() *MockResolver {
	return &MockResolver{
		AutoIndexingRootResolverFunc: &ResolverAutoIndexingRootResolverFunc{
			defaultHook: func() graphql.RootResolver {
				panic("unexpected invocation of MockResolver.AutoIndexingRootResolver")
			},
		},
		CodeNavResolverFunc: &ResolverCodeNavResolverFunc{
			defaultHook: func() resolvers.CodeNavResolver {
				panic("unexpected invocation of MockResolver.CodeNavResolver")
			},
		},
		ExecutorResolverFunc: &ResolverExecutorResolverFunc{
			defaultHook: func() graphql1.Resolver {
				panic("unexpected invocation of MockResolver.ExecutorResolver")
			},
		},
		PoliciesRootResolverFunc: &ResolverPoliciesRootResolverFunc{
			defaultHook: func() graphql2.RootResolver {
				panic("unexpected invocation of MockResolver.PoliciesRootResolver")
			},
		},
		UploadRootResolverFunc: &ResolverUploadRootResolverFunc{
			defaultHook: func() graphql3.RootResolver {
				panic("unexpected invocation of MockResolver.UploadRootResolver")
			},
		},
	}
}

// NewMockResolverFrom creates a new mock of the MockResolver interface. All
// methods delegate to the given implementation, unless overwritten.
func NewMockResolverFrom(i resolvers.Resolver) *MockResolver {
	return &MockResolver{
		AutoIndexingRootResolverFunc: &ResolverAutoIndexingRootResolverFunc{
			defaultHook: i.AutoIndexingRootResolver,
		},
		CodeNavResolverFunc: &ResolverCodeNavResolverFunc{
			defaultHook: i.CodeNavResolver,
		},
		ExecutorResolverFunc: &ResolverExecutorResolverFunc{
			defaultHook: i.ExecutorResolver,
		},
		PoliciesRootResolverFunc: &ResolverPoliciesRootResolverFunc{
			defaultHook: i.PoliciesRootResolver,
		},
		UploadRootResolverFunc: &ResolverUploadRootResolverFunc{
			defaultHook: i.UploadRootResolver,
		},
	}
}

// ResolverAutoIndexingRootResolverFunc describes the behavior when the
// AutoIndexingRootResolver method of the parent MockResolver instance is
// invoked.
type ResolverAutoIndexingRootResolverFunc struct {
	defaultHook func() graphql.RootResolver
	hooks       []func() graphql.RootResolver
	history     []ResolverAutoIndexingRootResolverFuncCall
	mutex       sync.Mutex
}

// AutoIndexingRootResolver delegates to the next hook function in the queue
// and stores the parameter and result values of this invocation.
func (m *MockResolver) AutoIndexingRootResolver() graphql.RootResolver {
	r0 := m.AutoIndexingRootResolverFunc.nextHook()()
	m.AutoIndexingRootResolverFunc.appendCall(ResolverAutoIndexingRootResolverFuncCall{r0})
	return r0
}

// SetDefaultHook sets function that is called when the
// AutoIndexingRootResolver method of the parent MockResolver instance is
// invoked and the hook queue is empty.
func (f *ResolverAutoIndexingRootResolverFunc) SetDefaultHook(hook func() graphql.RootResolver) {
	f.defaultHook = hook
}

// PushHook adds a function to the end of hook queue. Each invocation of the
// AutoIndexingRootResolver method of the parent MockResolver instance
// invokes the hook at the front of the queue and discards it. After the
// queue is empty, the default hook function is invoked for any future
// action.
func (f *ResolverAutoIndexingRootResolverFunc) PushHook(hook func() graphql.RootResolver) {
	f.mutex.Lock()
	f.hooks = append(f.hooks, hook)
	f.mutex.Unlock()
}

// SetDefaultReturn calls SetDefaultHook with a function that returns the
// given values.
func (f *ResolverAutoIndexingRootResolverFunc) SetDefaultReturn(r0 graphql.RootResolver) {
	f.SetDefaultHook(func() graphql.RootResolver {
		return r0
	})
}

// PushReturn calls PushHook with a function that returns the given values.
func (f *ResolverAutoIndexingRootResolverFunc) PushReturn(r0 graphql.RootResolver) {
	f.PushHook(func() graphql.RootResolver {
		return r0
	})
}

func (f *ResolverAutoIndexingRootResolverFunc) nextHook() func() graphql.RootResolver {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	if len(f.hooks) == 0 {
		return f.defaultHook
	}

	hook := f.hooks[0]
	f.hooks = f.hooks[1:]
	return hook
}

func (f *ResolverAutoIndexingRootResolverFunc) appendCall(r0 ResolverAutoIndexingRootResolverFuncCall) {
	f.mutex.Lock()
	f.history = append(f.history, r0)
	f.mutex.Unlock()
}

// History returns a sequence of ResolverAutoIndexingRootResolverFuncCall
// objects describing the invocations of this function.
func (f *ResolverAutoIndexingRootResolverFunc) History() []ResolverAutoIndexingRootResolverFuncCall {
	f.mutex.Lock()
	history := make([]ResolverAutoIndexingRootResolverFuncCall, len(f.history))
	copy(history, f.history)
	f.mutex.Unlock()

	return history
}

// ResolverAutoIndexingRootResolverFuncCall is an object that describes an
// invocation of method AutoIndexingRootResolver on an instance of
// MockResolver.
type ResolverAutoIndexingRootResolverFuncCall struct {
	// Result0 is the value of the 1st result returned from this method
	// invocation.
	Result0 graphql.RootResolver
}

// Args returns an interface slice containing the arguments of this
// invocation.
func (c ResolverAutoIndexingRootResolverFuncCall) Args() []interface{} {
	return []interface{}{}
}

// Results returns an interface slice containing the results of this
// invocation.
func (c ResolverAutoIndexingRootResolverFuncCall) Results() []interface{} {
	return []interface{}{c.Result0}
}

// ResolverCodeNavResolverFunc describes the behavior when the
// CodeNavResolver method of the parent MockResolver instance is invoked.
type ResolverCodeNavResolverFunc struct {
	defaultHook func() resolvers.CodeNavResolver
	hooks       []func() resolvers.CodeNavResolver
	history     []ResolverCodeNavResolverFuncCall
	mutex       sync.Mutex
}

// CodeNavResolver delegates to the next hook function in the queue and
// stores the parameter and result values of this invocation.
func (m *MockResolver) CodeNavResolver() resolvers.CodeNavResolver {
	r0 := m.CodeNavResolverFunc.nextHook()()
	m.CodeNavResolverFunc.appendCall(ResolverCodeNavResolverFuncCall{r0})
	return r0
}

// SetDefaultHook sets function that is called when the CodeNavResolver
// method of the parent MockResolver instance is invoked and the hook queue
// is empty.
func (f *ResolverCodeNavResolverFunc) SetDefaultHook(hook func() resolvers.CodeNavResolver) {
	f.defaultHook = hook
}

// PushHook adds a function to the end of hook queue. Each invocation of the
// CodeNavResolver method of the parent MockResolver instance invokes the
// hook at the front of the queue and discards it. After the queue is empty,
// the default hook function is invoked for any future action.
func (f *ResolverCodeNavResolverFunc) PushHook(hook func() resolvers.CodeNavResolver) {
	f.mutex.Lock()
	f.hooks = append(f.hooks, hook)
	f.mutex.Unlock()
}

// SetDefaultReturn calls SetDefaultHook with a function that returns the
// given values.
func (f *ResolverCodeNavResolverFunc) SetDefaultReturn(r0 resolvers.CodeNavResolver) {
	f.SetDefaultHook(func() resolvers.CodeNavResolver {
		return r0
	})
}

// PushReturn calls PushHook with a function that returns the given values.
func (f *ResolverCodeNavResolverFunc) PushReturn(r0 resolvers.CodeNavResolver) {
	f.PushHook(func() resolvers.CodeNavResolver {
		return r0
	})
}

func (f *ResolverCodeNavResolverFunc) nextHook() func() resolvers.CodeNavResolver {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	if len(f.hooks) == 0 {
		return f.defaultHook
	}

	hook := f.hooks[0]
	f.hooks = f.hooks[1:]
	return hook
}

func (f *ResolverCodeNavResolverFunc) appendCall(r0 ResolverCodeNavResolverFuncCall) {
	f.mutex.Lock()
	f.history = append(f.history, r0)
	f.mutex.Unlock()
}

// History returns a sequence of ResolverCodeNavResolverFuncCall objects
// describing the invocations of this function.
func (f *ResolverCodeNavResolverFunc) History() []ResolverCodeNavResolverFuncCall {
	f.mutex.Lock()
	history := make([]ResolverCodeNavResolverFuncCall, len(f.history))
	copy(history, f.history)
	f.mutex.Unlock()

	return history
}

// ResolverCodeNavResolverFuncCall is an object that describes an invocation
// of method CodeNavResolver on an instance of MockResolver.
type ResolverCodeNavResolverFuncCall struct {
	// Result0 is the value of the 1st result returned from this method
	// invocation.
	Result0 resolvers.CodeNavResolver
}

// Args returns an interface slice containing the arguments of this
// invocation.
func (c ResolverCodeNavResolverFuncCall) Args() []interface{} {
	return []interface{}{}
}

// Results returns an interface slice containing the results of this
// invocation.
func (c ResolverCodeNavResolverFuncCall) Results() []interface{} {
	return []interface{}{c.Result0}
}

// ResolverExecutorResolverFunc describes the behavior when the
// ExecutorResolver method of the parent MockResolver instance is invoked.
type ResolverExecutorResolverFunc struct {
	defaultHook func() graphql1.Resolver
	hooks       []func() graphql1.Resolver
	history     []ResolverExecutorResolverFuncCall
	mutex       sync.Mutex
}

// ExecutorResolver delegates to the next hook function in the queue and
// stores the parameter and result values of this invocation.
func (m *MockResolver) ExecutorResolver() graphql1.Resolver {
	r0 := m.ExecutorResolverFunc.nextHook()()
	m.ExecutorResolverFunc.appendCall(ResolverExecutorResolverFuncCall{r0})
	return r0
}

// SetDefaultHook sets function that is called when the ExecutorResolver
// method of the parent MockResolver instance is invoked and the hook queue
// is empty.
func (f *ResolverExecutorResolverFunc) SetDefaultHook(hook func() graphql1.Resolver) {
	f.defaultHook = hook
}

// PushHook adds a function to the end of hook queue. Each invocation of the
// ExecutorResolver method of the parent MockResolver instance invokes the
// hook at the front of the queue and discards it. After the queue is empty,
// the default hook function is invoked for any future action.
func (f *ResolverExecutorResolverFunc) PushHook(hook func() graphql1.Resolver) {
	f.mutex.Lock()
	f.hooks = append(f.hooks, hook)
	f.mutex.Unlock()
}

// SetDefaultReturn calls SetDefaultHook with a function that returns the
// given values.
func (f *ResolverExecutorResolverFunc) SetDefaultReturn(r0 graphql1.Resolver) {
	f.SetDefaultHook(func() graphql1.Resolver {
		return r0
	})
}

// PushReturn calls PushHook with a function that returns the given values.
func (f *ResolverExecutorResolverFunc) PushReturn(r0 graphql1.Resolver) {
	f.PushHook(func() graphql1.Resolver {
		return r0
	})
}

func (f *ResolverExecutorResolverFunc) nextHook() func() graphql1.Resolver {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	if len(f.hooks) == 0 {
		return f.defaultHook
	}

	hook := f.hooks[0]
	f.hooks = f.hooks[1:]
	return hook
}

func (f *ResolverExecutorResolverFunc) appendCall(r0 ResolverExecutorResolverFuncCall) {
	f.mutex.Lock()
	f.history = append(f.history, r0)
	f.mutex.Unlock()
}

// History returns a sequence of ResolverExecutorResolverFuncCall objects
// describing the invocations of this function.
func (f *ResolverExecutorResolverFunc) History() []ResolverExecutorResolverFuncCall {
	f.mutex.Lock()
	history := make([]ResolverExecutorResolverFuncCall, len(f.history))
	copy(history, f.history)
	f.mutex.Unlock()

	return history
}

// ResolverExecutorResolverFuncCall is an object that describes an
// invocation of method ExecutorResolver on an instance of MockResolver.
type ResolverExecutorResolverFuncCall struct {
	// Result0 is the value of the 1st result returned from this method
	// invocation.
	Result0 graphql1.Resolver
}

// Args returns an interface slice containing the arguments of this
// invocation.
func (c ResolverExecutorResolverFuncCall) Args() []interface{} {
	return []interface{}{}
}

// Results returns an interface slice containing the results of this
// invocation.
func (c ResolverExecutorResolverFuncCall) Results() []interface{} {
	return []interface{}{c.Result0}
}

// ResolverPoliciesRootResolverFunc describes the behavior when the
// PoliciesRootResolver method of the parent MockResolver instance is
// invoked.
type ResolverPoliciesRootResolverFunc struct {
	defaultHook func() graphql2.RootResolver
	hooks       []func() graphql2.RootResolver
	history     []ResolverPoliciesRootResolverFuncCall
	mutex       sync.Mutex
}

// PoliciesRootResolver delegates to the next hook function in the queue and
// stores the parameter and result values of this invocation.
func (m *MockResolver) PoliciesRootResolver() graphql2.RootResolver {
	r0 := m.PoliciesRootResolverFunc.nextHook()()
	m.PoliciesRootResolverFunc.appendCall(ResolverPoliciesRootResolverFuncCall{r0})
	return r0
}

// SetDefaultHook sets function that is called when the PoliciesRootResolver
// method of the parent MockResolver instance is invoked and the hook queue
// is empty.
func (f *ResolverPoliciesRootResolverFunc) SetDefaultHook(hook func() graphql2.RootResolver) {
	f.defaultHook = hook
}

// PushHook adds a function to the end of hook queue. Each invocation of the
// PoliciesRootResolver method of the parent MockResolver instance invokes
// the hook at the front of the queue and discards it. After the queue is
// empty, the default hook function is invoked for any future action.
func (f *ResolverPoliciesRootResolverFunc) PushHook(hook func() graphql2.RootResolver) {
	f.mutex.Lock()
	f.hooks = append(f.hooks, hook)
	f.mutex.Unlock()
}

// SetDefaultReturn calls SetDefaultHook with a function that returns the
// given values.
func (f *ResolverPoliciesRootResolverFunc) SetDefaultReturn(r0 graphql2.RootResolver) {
	f.SetDefaultHook(func() graphql2.RootResolver {
		return r0
	})
}

// PushReturn calls PushHook with a function that returns the given values.
func (f *ResolverPoliciesRootResolverFunc) PushReturn(r0 graphql2.RootResolver) {
	f.PushHook(func() graphql2.RootResolver {
		return r0
	})
}

func (f *ResolverPoliciesRootResolverFunc) nextHook() func() graphql2.RootResolver {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	if len(f.hooks) == 0 {
		return f.defaultHook
	}

	hook := f.hooks[0]
	f.hooks = f.hooks[1:]
	return hook
}

func (f *ResolverPoliciesRootResolverFunc) appendCall(r0 ResolverPoliciesRootResolverFuncCall) {
	f.mutex.Lock()
	f.history = append(f.history, r0)
	f.mutex.Unlock()
}

// History returns a sequence of ResolverPoliciesRootResolverFuncCall
// objects describing the invocations of this function.
func (f *ResolverPoliciesRootResolverFunc) History() []ResolverPoliciesRootResolverFuncCall {
	f.mutex.Lock()
	history := make([]ResolverPoliciesRootResolverFuncCall, len(f.history))
	copy(history, f.history)
	f.mutex.Unlock()

	return history
}

// ResolverPoliciesRootResolverFuncCall is an object that describes an
// invocation of method PoliciesRootResolver on an instance of MockResolver.
type ResolverPoliciesRootResolverFuncCall struct {
	// Result0 is the value of the 1st result returned from this method
	// invocation.
	Result0 graphql2.RootResolver
}

// Args returns an interface slice containing the arguments of this
// invocation.
func (c ResolverPoliciesRootResolverFuncCall) Args() []interface{} {
	return []interface{}{}
}

// Results returns an interface slice containing the results of this
// invocation.
func (c ResolverPoliciesRootResolverFuncCall) Results() []interface{} {
	return []interface{}{c.Result0}
}

// ResolverUploadRootResolverFunc describes the behavior when the
// UploadRootResolver method of the parent MockResolver instance is invoked.
type ResolverUploadRootResolverFunc struct {
	defaultHook func() graphql3.RootResolver
	hooks       []func() graphql3.RootResolver
	history     []ResolverUploadRootResolverFuncCall
	mutex       sync.Mutex
}

// UploadRootResolver delegates to the next hook function in the queue and
// stores the parameter and result values of this invocation.
func (m *MockResolver) UploadRootResolver() graphql3.RootResolver {
	r0 := m.UploadRootResolverFunc.nextHook()()
	m.UploadRootResolverFunc.appendCall(ResolverUploadRootResolverFuncCall{r0})
	return r0
}

// SetDefaultHook sets function that is called when the UploadRootResolver
// method of the parent MockResolver instance is invoked and the hook queue
// is empty.
func (f *ResolverUploadRootResolverFunc) SetDefaultHook(hook func() graphql3.RootResolver) {
	f.defaultHook = hook
}

// PushHook adds a function to the end of hook queue. Each invocation of the
// UploadRootResolver method of the parent MockResolver instance invokes the
// hook at the front of the queue and discards it. After the queue is empty,
// the default hook function is invoked for any future action.
func (f *ResolverUploadRootResolverFunc) PushHook(hook func() graphql3.RootResolver) {
	f.mutex.Lock()
	f.hooks = append(f.hooks, hook)
	f.mutex.Unlock()
}

// SetDefaultReturn calls SetDefaultHook with a function that returns the
// given values.
func (f *ResolverUploadRootResolverFunc) SetDefaultReturn(r0 graphql3.RootResolver) {
	f.SetDefaultHook(func() graphql3.RootResolver {
		return r0
	})
}

// PushReturn calls PushHook with a function that returns the given values.
func (f *ResolverUploadRootResolverFunc) PushReturn(r0 graphql3.RootResolver) {
	f.PushHook(func() graphql3.RootResolver {
		return r0
	})
}

func (f *ResolverUploadRootResolverFunc) nextHook() func() graphql3.RootResolver {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	if len(f.hooks) == 0 {
		return f.defaultHook
	}

	hook := f.hooks[0]
	f.hooks = f.hooks[1:]
	return hook
}

func (f *ResolverUploadRootResolverFunc) appendCall(r0 ResolverUploadRootResolverFuncCall) {
	f.mutex.Lock()
	f.history = append(f.history, r0)
	f.mutex.Unlock()
}

// History returns a sequence of ResolverUploadRootResolverFuncCall objects
// describing the invocations of this function.
func (f *ResolverUploadRootResolverFunc) History() []ResolverUploadRootResolverFuncCall {
	f.mutex.Lock()
	history := make([]ResolverUploadRootResolverFuncCall, len(f.history))
	copy(history, f.history)
	f.mutex.Unlock()

	return history
}

// ResolverUploadRootResolverFuncCall is an object that describes an
// invocation of method UploadRootResolver on an instance of MockResolver.
type ResolverUploadRootResolverFuncCall struct {
	// Result0 is the value of the 1st result returned from this method
	// invocation.
	Result0 graphql3.RootResolver
}

// Args returns an interface slice containing the arguments of this
// invocation.
func (c ResolverUploadRootResolverFuncCall) Args() []interface{} {
	return []interface{}{}
}

// Results returns an interface slice containing the results of this
// invocation.
func (c ResolverUploadRootResolverFuncCall) Results() []interface{} {
	return []interface{}{c.Result0}
}
