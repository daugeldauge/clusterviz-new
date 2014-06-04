require 'open3'
require 'sinatra'
require 'sinatra/contrib'
require "timeout"

configure do
  raise "Compilation error" unless system 'make -C src/'
  set :show_exceptions => false
end 

def error_page msg
  erb :error, :locals => {:msg => msg}
end

get '/out.svg' do
  Timeout::timeout(29) do
    if params[:from] and not params[:from].empty? and params[:to] and not params[:to].empty?
      levels = params[:from] + ' ' + params[:to]
    else
      levels = '-1 -1'
    end

    cmd = ['bin/levels']
    cmd.push params[:cluster] + '.dot'
    cmd.push levels 
    cmd.push params[:drawingAlgorithm]
    cmd.push 'out.svg' 
    
    if params[:edgeType]
      cmd.push '--edge-type=' + params[:edgeType]
    end
    if params[:nodeAttrs]
      cmd.push '--node-attrs=' + params[:nodeAttrs].gsub(/\s+/, '\ ')
    end
    if params[:aggregation] == 'on'
      cmd.push '--aggregate'
    end
    if params[:singleNodesRemoving] == 'on'
      cmd.push '--remove-single-nodes'
    end

    cmd = cmd.join ' '

    puts
    puts cmd
    output, status = Open3.capture2e cmd
    puts output
    puts

    if status.success?
      headers 'Content-Type' => 'image/svg+xml', 'Content-Disposition' =>'inline'
      puts 'OK'
      body IO.read 'out.svg'
    else
      error_page("<pre>" + output + "<br>" + status.to_s + "</pre>" ) 
    end
  end
end

get '/' do
  clusters = ["cheb", "lom", "lab"]
  dot_info = {}
  clusters.each do |cluster|
    file = cluster + ".dot"
    stat = File.stat file
    info = "<strong>Last updated:</strong> " + stat.ctime.strftime("%d.%m.%Y %H:%M:%S") + "<br>"
    info += "<strong>Size:</strong> " + "%.2f" % [stat.size.to_f / (1024 * 1024)] + " MiB<br>"
    #info += "IP: 0.0.0.0"
    dot_info[cluster.to_sym] = info;
  end
  erb :start, :locals => {:dot_info => dot_info}
end


get '/continue' do
  Timeout::timeout(29) do
    if params[:update] == 'on' or params[:cluster] == 'custom'
      urls = {
          :lom => "http://user@stat1.lomonosov.parallel.ru:4448/view/export?format=dot", 
          :cheb => "http://user@graphit.parallel.ru:4446/view/export?format=dot", 
          :lab => "http://user@graphit.parallel.ru:4447/view/export?format=dot",
          :custom => params[:customURL]
      }
      cluster = params[:cluster]
      cmd = 'curl ' + urls[cluster.to_sym] + ' > ' + cluster + '.dot'
      puts cmd
      if not system cmd
        return error_page 'Could not load .dot file.'
      end
    end

    cmd = 'bin/levels ' + params[:cluster] + '.dot --print-edge-types'
    
    puts
    puts cmd
    output, status = Open3.capture2e cmd
    puts output
    puts

    if status.success?
      erb :form, :locals => {:types => output.split}
    else 
      error_page("Could not retrieve edge types from .dot file: <pre>" + output + "<br>" + status.to_s + "</pre>")
    end
  end
end

get '/about' do
  erb :about
end

get '/contact' do
  erb :contact
end

not_found do
  error_page '404'
end

error Timeout::Error do
  error_page "Time limit exceeded." 
end