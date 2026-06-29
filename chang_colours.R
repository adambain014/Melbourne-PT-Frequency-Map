svg_to_dark <- function(input_file, output_file) {
  
  svg_text <- readLines(input_file, warn = FALSE)
  
  colour_map <- c(
    
    # Backgrounds ---
    "#ffffff"  = "#1F1F1F",   # white
    "#fff" = "#1F1F1F",
    "#000000"  = "#cccccc",   # black text/outlines 
    
    # Water 
    "#b5effb"  = "#10213B",   # water 
    "#bbdaea"  = "#0d1e36",   # water variant 
    "#a9d2e5"  = "#071020",   # water variant 
    
    # Airport 
    "#b1c9cd"  = "#1a2530",   # airport backdrop 
    "#dfe9eb"  = "#1e2c38",   # airport runway 
    
    # Parks / green space 
    "#b9d3b5"  = "#1f4a23",   # parks
    
    # Greyscale 
    "#dfdfdf"  = "#383838",   # light grey areas 
    "#d1d1d1"  = "#383838",   # light grey 
    "#9b9b9b"  = "#bbbbbb",   # suburb labels 
    "#7a7a7a"  = "#999999",   # mid grey
    "#6a6a6a"  = "#aaaaaa",   # insert text/border
    "#4d4d4d"  = "#787878",   # dark grey features
    "#f9f9f9"=   "#282828",  # CBD
    
    # Transit frequency bands - Viridis derived (very derived)
    "#8d6f32"  = "#c07830",   # < every 60 min   
    "#5d9a9d"  = "#CF5DBF",   # every 60 min
    "#2c8ab8"  = "#3d9ae8",   # every 30 min   
    "#642d91"  = "#20d090",   # every 20 min   
    "#a62624"  = "#FFE030",   # every 15 min 
    "#671415"  = "#ffffff",   # every 10 min 
    
    # Flexiride (on-demand) 
    "#eba53c"  = "#dba17dff", # flexiride text 
    "#fdf1df"  = "#301F13",   # flexiride geom 
    "#fae8ce"  = "#291A10",   # flexiride geom 2 
    
    
    "#0060a7"  = "#1a7abf"    # unknown blue 
  )

  
  # Replace on original text using ignore.case = TRUE
  out <- svg_text
  
  
  out <- sub(
    "<style>",
    "<style>svg{fill:#cccccc;}",
    out
  )
  
  # Stroke replacements
  out <- gsub('stroke="#000000"', 'stroke="#cccccc"', out, ignore.case = TRUE)
  out <- gsub('stroke="#000"',    'stroke="#cccccc"', out, ignore.case = TRUE)
  out <- gsub('stroke="black"',   'stroke="#cccccc"', out, ignore.case = TRUE)
  out <- gsub('stroke:black',     'stroke:#cccccc',   out, ignore.case = TRUE)
  out <- gsub('stroke:#000000',   'stroke:#cccccc',   out, ignore.case = TRUE)
  out <- gsub('stroke:#000',      'stroke:#cccccc',   out, ignore.case = TRUE)
  
  for (i in seq_along(colour_map)) {
    old_col <- names(colour_map)[i]
    new_col <- colour_map[i]
    out <- gsub(old_col, new_col, out, ignore.case = TRUE, fixed = FALSE)
  }
  
  # Named colour replacements
  out <- gsub('fill:white',  paste0('fill:', colour_map["#ffffff"]),  out, ignore.case = TRUE)
  out <- gsub('fill:black',  paste0('fill:', colour_map["#000000"]),  out, ignore.case = TRUE)
  out <- gsub('"white"',     paste0('"', colour_map["#ffffff"], '"'), out, ignore.case = TRUE)
  out <- gsub('"black"',     paste0('"', colour_map["#000000"], '"'), out, ignore.case = TRUE)
  
  # Replace scour-generated class colours
  out <- gsub("\\.a\\{fill:#fff;\\}", ".a{fill:#1F1F1F;}", out)
  out <- gsub("\\.b\\{fill:#f60;\\}", ".b{fill:???;}", out)
  out <- gsub("\\.c\\{fill:#0060a7;\\}", ".c{fill:#1a7abf;}", out)
  
  
  
  # Page background (Inkscape namedview)
  out <- gsub('pagecolor="#ffffff"', paste0('pagecolor="', colour_map["#ffffff"], '"'), out, ignore.case = TRUE)
  
  writeLines(out, output_file)
  message("Dark map written to: ", output_file)
}

# Run 
svg_to_dark("recent_map.svg", "dark_map.svg")
