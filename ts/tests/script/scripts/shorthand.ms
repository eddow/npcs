if (true) then print("true")
if (false) then print("true") else print("true")
print("was")
if (false) then
	print(false)
else
	print(true)
end if
if (false) then
	print(false)
else
	print(true)
	if (false) then print("true") else print("true")
end if

for i in [] print(i)
for b in []
	print(b)
end for
do while (i < b)
	i += 1
loop
do while (b < i)
	b += 1
loop
myFunction = function(v)
  print(v)
end function
otherFunction = function(n)
	print(n)
end function

if not @ref then
end if

if true then
	elseSomething = false
else
end if

for c in clist //x
	print("moo")
end for

do
	print("moo")
loop

if true then //x
	print("moo")
end if

if x < 0 then return else print x
if true and true then item = function()
    print "hello"
end function