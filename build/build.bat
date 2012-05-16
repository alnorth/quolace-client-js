java -jar compiler.jar --js ../quolace.js --js_output_file quolace.min.js --compilation_level ADVANCED_OPTIMIZATIONS --externs externs/jquery-1.7.js
java -jar compiler.jar --js ../quolace.js --js_output_file quolace.min.debug.js --compilation_level ADVANCED_OPTIMIZATIONS --externs externs/jquery-1.7.js --formatting pretty_print
