// Test named function syntax
function myFunction()
    return "Hello from named function"
end function

// Test with parameters
function add(a, b)
    return a + b
end function

// Test with default parameters
function greet(name = "World")
    return "Hello " + name
end function

// Test calling the functions
print myFunction()
print add(5, 3)
print greet()
print greet("Alice")

// Test that both syntaxes work (named vs anonymous)
myFunc = function()
    return "Anonymous function"
end function

print myFunc()
