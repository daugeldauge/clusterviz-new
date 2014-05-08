require 'sinatra'

configure do
  raise "Compilation error" unless system 'make -C src/'
end 

def error_page msg
  erb :error, :locals => {:msg => msg}
end

get '/out.svg' do
  status 200  
  if params['levels'] == 'on'
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
  if params[:aggregation] == 'on'
    cmd.push '--aggregate'
  end
  if params[:singleNodesRemoving] == 'on'
    cmd.push '--remove-single-nodes'
  end

  cmd = cmd.join ' '

  puts cmd
  if system cmd
    headers 'Content-Type' => 'image/svg+xml', 'Content-Disposition' =>'inline'
    puts 'OK'
    body IO.read 'out.svg'
  else
    error_page "Generator's execution error." 
  end
end

get '/' do
  erb :start
end


get '/continue' do
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
  puts cmd
  types = %x{#{cmd}}
  if $?.success?
    erb :form, :locals => {:types => types.split}
  else 
    error_page 'Could not retrieve edge types from .dot file.'
  end
end

not_found do
  error_page '404'
end